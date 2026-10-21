# SPDX-License-Identifier: GPL-3.0-only
"""Regression tests for real WAL artifacts and explicit review conversations."""

from contextlib import closing
import io
import json
import os
from pathlib import Path
import sqlite3
import unittest
from unittest.mock import patch
import zipfile

import common
import review
import session
import test_review as fixtures


class FollowupTests(unittest.TestCase):
    setUp = fixtures.ReviewTests.setUp
    tearDown = fixtures.ReviewTests.tearDown
    checkpoint = fixtures.ReviewTests.checkpoint

    def test_wal_snapshot_directory_zip_really_restores(self):
        database = session.state_database(self.root)
        fixtures.create_database(database)
        with closing(sqlite3.connect(database)) as writer:
            writer.execute('PRAGMA journal_mode=WAL')
            writer.execute('INSERT INTO messages VALUES (2, ?, ?)', ('20261021_1', 'new WAL evidence'))
            writer.commit()
            self.assertGreater(Path(str(database) + '-wal').stat().st_size, 0)
            common.write_json(self.root / 'input.json', {'number': 7, 'head_sha': 'a' * 40,
                              'base_sha': 'b' * 40, 'merge_base_sha': 'b' * 40, 'input_fingerprint': 'fp'})
            common.write_json(self.root / 'result.json', {'review': fixtures.ANSWER})
            common.write_json(self.root / 'resume.json', {'resumed': False})
            common.write_json(self.root / 'discussion.json', {'comments': []})
            with patch.object(session, 'pull_request', return_value={'merged': False}), \
                    patch.object(session, 'workflow_run', return_value={'workflow_id': 123}):
                session.snapshot(self.root)
        checkpoint = self.root / 'checkpoint'
        self.assertEqual({item.name for item in checkpoint.iterdir()}, session.PAYLOAD_FILES)
        with closing(session.connect_readonly(checkpoint / 'sessions.db')) as db:
            self.assertEqual(db.execute('PRAGMA journal_mode').fetchone()[0], 'delete')
        # Mirror upload-artifact: zip ALL files in the actual export directory,
        # not a hand-picked test fixture that hides accidental WAL/SHM files.
        blob = io.BytesIO()
        with zipfile.ZipFile(blob, 'w') as archive:
            for item in checkpoint.iterdir():
                archive.write(item, item.name)
        restored = self.root / 'restored'
        restored.mkdir()
        common.write_json(restored / 'input.json', {'number': 7})
        artifact = {'id': 1, 'workflow_run': {'id': 100}}
        with patch.object(session, 'workflow_run', return_value={'workflow_id': 123}), \
                patch.object(session, 'checkpoint_artifacts', return_value=[artifact]), \
                patch.object(session, 'trusted_artifact', return_value=True), \
                patch.object(session, 'api', return_value=blob.getvalue()):
            session.restore(restored)
        self.assertTrue(common.read_json(restored / 'resume.json')['resumed'])
        with closing(session.connect_readonly(session.state_database(restored))) as db:
            self.assertEqual(db.execute('SELECT content FROM messages ORDER BY id').fetchall(),
                             [('original evidence',), ('new WAL evidence',)])
            self.assertIn('keep this', db.execute('SELECT extension_data FROM sessions').fetchone()[0])

    def test_legacy_empty_wal_export_is_accepted_but_nonempty_wal_is_not(self):
        for wal, accepted in ((b'', True), (b'unbacked transaction', False)):
            blob = io.BytesIO(self.checkpoint())
            with zipfile.ZipFile(blob, 'a') as archive:
                archive.writestr('sessions.db-wal', wal)
                archive.writestr('sessions.db-shm', bytes(32768))
            if accepted:
                _, contents = session.decode_checkpoint(blob.getvalue(), 7)
                self.assertEqual(set(contents), session.PAYLOAD_FILES)
            else:
                with self.assertRaisesRegex(common.ReviewError, 'uncheckpointed_legacy_wal'):
                    session.decode_checkpoint(blob.getvalue(), 7)

    def test_trusted_recipe_update_keeps_compatible_conversation(self):
        _, contents = session.decode_checkpoint(self.checkpoint(), 7)
        manifest = json.loads(contents['manifest.json'])
        manifest['recipe_sha256'] = '0' * 64
        contents['manifest.json'] = json.dumps(manifest).encode()
        blob = io.BytesIO()
        with zipfile.ZipFile(blob, 'w') as archive:
            for name, value in contents.items():
                archive.writestr(name, value)
        session.decode_checkpoint(blob.getvalue(), 7)
        with patch.dict(os.environ, {'GOOSE_IMAGE': 'different-image'}):
            with self.assertRaisesRegex(common.ReviewError, 'checkpoint_incompatible'):
                session.decode_checkpoint(blob.getvalue(), 7)

    def test_checkpoint_order_uses_creation_time_not_sharded_artifact_ids(self):
        artifacts = [
            {'id': 200, 'name': common.artifact_prefix('session', 7) + 'old', 'created_at': '2026-10-21T20:16:00Z'},
            {'id': 100, 'name': common.artifact_prefix('session', 7) + 'new', 'created_at': '2026-10-21T20:19:00Z'},
        ]
        with patch.object(session, 'pages', return_value=iter(artifacts)):
            self.assertEqual(session.checkpoint_artifacts(7)[0]['id'], 100)

    def test_graphql_bot_login_recovers_previous_review_without_trusting_users(self):
        bot = {'login': 'github-actions', '__typename': 'Bot'}
        comments = [
            {'id': 'bot', 'author': bot, 'body': common.MARKER + '\nPrevious review', 'updatedAt': '1'},
            {'id': 'fake', 'author': {'login': 'github-actions', '__typename': 'User'},
             'body': common.MARKER + '\nNot a bot', 'updatedAt': '2'},
        ]
        with patch.object(review, 'connection_pages', side_effect=lambda _, field, _fragment:
                          iter(comments if field == 'comments' else [])):
            self.assertEqual(review.context(7)['previous_ai_review']['id'], 'bot')
        self.assertTrue(review.own_bot({'login': 'github-actions[bot]', 'type': 'Bot'}))

    def command(self, body='/review it should stay there', identifier='IC_test'):
        return {'id': identifier, 'body': body,
                'url': 'https://github.com/pcace/RoadbookNavi/pull/7#issuecomment-123',
                'author': {'login': 'pcace', '__typename': 'User'}}

    def test_only_explicit_commands_trigger_issue_comment_reviews(self):
        event = {'issue': {'number': 7, 'pull_request': {}}, 'action': 'created',
                 'sender': {'login': 'pcace', 'type': 'User'}}
        # The real pull_request link is nonempty in GitHub's payload.
        event['issue']['pull_request'] = {'url': 'https://api.github.com/repos/pcace/RoadbookNavi/pulls/7'}
        for body, expected in (('it should stay there', None), ('/reviewer', None),
                               ('/review', 7), ('/review it should stay there', 7)):
            event['comment'] = {'body': body}
            with self.subTest(body=body):
                self.assertEqual(review.event_number_actor(event)[0], expected)
        event['action'] = 'deleted'
        self.assertEqual(review.event_number_actor(event), (None, None))

    def test_initial_pr_event_still_starts_without_a_command(self):
        event = {'pull_request': {'number': 7}, 'sender': {'login': 'pcace', 'type': 'User'}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'pull_request_target'}):
            self.assertEqual(review.event_number_actor(event)[0], 7)

    def test_targets_deduplicate_answers_but_reopen_edited_commands(self):
        command = self.command()
        plain = self.command('it should stay there', 'plain')
        discussion = {'comments': [plain, command], 'reviews': [], 'threads': []}
        targets = review.reply_targets(discussion)
        self.assertEqual([target['comment_id'] for target in targets], ['IC_test'])
        marker = common.REPLY_PREFIX + targets[0]['version_key'] + ' -->'
        discussion['previous_ai_responses'] = [{'body': marker + '\nAnswered'}]
        self.assertEqual(review.reply_targets(discussion), [])
        command['body'] += ' because this is intentional'
        self.assertEqual(len(review.reply_targets(discussion)), 1)

    def test_inline_and_review_commands_are_also_reply_targets(self):
        discussion = {'comments': [], 'reviews': [self.command('/review check this', 'review')],
                      'threads': [{'comments': {'nodes': [self.command('/review why?', 'inline')]}}]}
        self.assertEqual({item['comment_id'] for item in review.reply_targets(discussion)}, {'review', 'inline'})

    def test_statement_command_cannot_finish_without_a_response(self):
        targets = review.reply_targets({'comments': [self.command()]})
        with self.assertRaisesRegex(common.ReviewError, 'command_response_missing'):
            review.final_answer(fixtures.completed(), 'current', targets)
        response = {'comment_id': 'IC_test', 'response': 'Understood. This is intentional, so I withdraw the unsupported cleanup finding.'}
        answer, replies = review.final_answer(fixtures.completed(responses=[response]), 'current', targets)
        self.assertEqual(answer, fixtures.ANSWER)
        self.assertEqual(replies[0]['version_key'], targets[0]['version_key'])

    def test_response_ids_and_fresh_final_tool_payload_must_match(self):
        targets = review.reply_targets({'comments': [self.command()]})
        for response in ({'comment_id': 'wrong', 'response': 'A sufficiently long answer.'},
                         {'comment_id': 'IC_test', 'response': 'OK'}):
            with self.subTest(response=response), self.assertRaisesRegex(common.ReviewError, 'command_response_invalid'):
                review.final_answer(fixtures.completed(responses=[response]), 'current', targets)
        value = fixtures.completed(responses=[{'comment_id': 'IC_test', 'response': 'A sufficiently long answer.'}])
        changed = json.loads(value['messages'][-1]['content'][0]['text'])
        changed['responses'][0]['response'] = 'A changed unvalidated answer.'
        value['messages'][-1]['content'][0]['text'] = json.dumps(changed)
        with self.assertRaisesRegex(common.ReviewError, 'new_final_output_missing'):
            review.final_answer(value, 'current', targets)

    def test_duplicate_response_cannot_cover_two_commands(self):
        targets = review.reply_targets({'comments': [self.command(), self.command('/review another question', 'second')]})
        response = {'comment_id': 'IC_test', 'response': 'A sufficiently long direct answer.'}
        with self.assertRaisesRegex(common.ReviewError, 'command_response_invalid'):
            review.final_answer(fixtures.completed(responses=[response, response]), 'current', targets)

    def test_inline_listener_without_a_command_cannot_start_the_model(self):
        event = self.root / 'event.json'
        common.write_json(event, {})
        pr = {'state': 'open', 'draft': False, 'head': {'repo': {'full_name': common.repository()}}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'workflow_run', 'GITHUB_EVENT_PATH': str(event)}), \
                patch.object(review, 'pull_request', return_value=pr), \
                patch.object(review, 'context', return_value={'comments': [self.command('ordinary comment')]}):
            review.capture(self.root)
        self.assertIn('should_review=false', (self.root / 'outputs').read_text())
        self.assertFalse((self.root / 'input.json').exists())

    def test_failed_publication_is_not_hidden_by_unchanged_fingerprint(self):
        source = {'number': 7, 'head_sha': 'a' * 40, 'base_sha': 'b' * 40, 'title': 'Fix',
                  'description': '', 'focus': '', 'force_review': False, 'input_fingerprint': 'same',
                  'reply_targets': review.reply_targets({'comments': [self.command()]})}
        common.write_json(self.root / 'input.json', source)
        common.write_json(self.root / 'resume.json', {'resumed': True, 'reason': 'restored',
                          'head_sha': 'a' * 40, 'input_fingerprint': 'same'})
        for name in ('discussion.json', 'previous-discussion.json'):
            common.write_json(self.root / name, {'comments': []})
        def git(_checkout, *args):
            if args[:2] == ('rev-parse', 'HEAD'):
                return 'a' * 40
            if args[0] == 'merge-base':
                return 'b' * 40
            return ''
        with patch.dict(os.environ, {'GITHUB_WORKSPACE': str(self.root)}), \
                patch.object(review, 'git', side_effect=git), patch.object(review, 'git_has', return_value=False):
            review.collect(self.root)
        self.assertIn('should_run=true', (self.root / 'outputs').read_text())

    def publication(self):
        target = review.reply_targets({'comments': [self.command()]})[0]
        result = {'number': 7, 'head_sha': 'a' * 40, 'review': fixtures.ANSWER,
                  'duration_seconds': 1, 'resumed': True, 'changed_files': 1, 'model': common.MODEL,
                  'responses': [{key: value for key, value in target.items() if key != 'body'}
                                | {'response': 'Understood. The change is intentional; I withdraw this finding.'}]}
        common.write_json(self.root / 'result.json', result)
        return result

    def publish_with(self, discussion, comments):
        pr = {'state': 'open', 'draft': False, 'head': {'sha': 'a' * 40,
               'repo': {'full_name': common.repository()}}}
        with patch.dict(os.environ, {'HEAD_SHA': 'a' * 40, 'GITHUB_SERVER_URL': 'https://github.com'}), \
                patch.object(review, 'pull_request', return_value=pr), \
                patch.object(review, 'context', return_value=discussion), \
                patch.object(review, 'pages', return_value=iter(comments)), \
                patch.object(review, 'api') as api:
            review.publish(self.root)
            return api.call_args_list

    def test_publisher_updates_summary_and_posts_a_separate_linked_response(self):
        self.publication()
        calls = self.publish_with({'comments': [self.command()]}, [
            {'id': 1, 'body': common.MARKER + '\nOld summary',
             'user': {'login': 'github-actions[bot]', 'type': 'Bot'}},
        ])
        self.assertEqual([call.kwargs['method'] for call in calls], ['PATCH', 'POST'])
        self.assertIn('#issuecomment-123', calls[1].kwargs['payload']['body'])
        self.assertIn('I withdraw this finding', calls[1].kwargs['payload']['body'])

    def test_publisher_does_not_duplicate_replies_on_retry(self):
        result = self.publication()
        existing = {'id': 2, 'body': common.REPLY_PREFIX + result['responses'][0]['version_key'] + ' -->\nAnswered',
                    'user': {'login': 'github-actions[bot]', 'type': 'Bot'}}
        calls = self.publish_with({'comments': [self.command()]}, [existing])
        self.assertEqual(len(calls), 1)  # Summary only, even if GraphQL lags REST.

    def test_publisher_skips_commands_edited_or_deleted_during_review(self):
        self.publication()
        for commands in ([], [self.command('/review changed request')]):
            with self.subTest(commands=commands):
                self.assertEqual(len(self.publish_with({'comments': commands}, [])), 1)
