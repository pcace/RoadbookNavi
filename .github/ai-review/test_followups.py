# SPDX-License-Identifier: GPL-3.0-only
"""Regression tests for real WAL artifacts and explicit review conversations."""

from contextlib import closing
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
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

    def command(self, body='it should stay there', identifier='IC_test'):
        return {'id': identifier, 'body': body,
                'url': 'https://github.com/pcace/RoadbookNavi/pull/7#issuecomment-123',
                'author': {'login': 'pcace', '__typename': 'User'}}

    def test_ordinary_comments_and_review_commands_trigger_reviews(self):
        event = {'issue': {'number': 7, 'pull_request': {}}, 'action': 'created',
                 'sender': {'login': 'pcace', 'type': 'User'}}
        # The real pull_request link is nonempty in GitHub's payload.
        event['issue']['pull_request'] = {'url': 'https://api.github.com/repos/pcace/RoadbookNavi/pulls/7'}
        for body, expected in (('it should stay there', 7), ('/reviewer', 7),
                               ('/review', 7), ('/review it should stay there', 7), (' ', None)):
            event['comment'] = {'body': body}
            with self.subTest(body=body):
                self.assertEqual(review.event_number_actor(event)[0], expected)
        event['action'] = 'deleted'
        self.assertEqual(review.event_number_actor(event), (None, None))

    def test_initial_pr_event_still_starts_without_a_command(self):
        event = {'pull_request': {'number': 7}, 'sender': {'login': 'pcace', 'type': 'User'}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'pull_request_target'}):
            self.assertEqual(review.event_number_actor(event)[0], 7)

    def capture_event(self, kind, action, discussion):
        event = self.root / 'event.json'
        common.write_json(event, {'action': action, 'comment': {'body': 'it should stay there'}})
        pr = {'number': 7, 'title': 'Fix', 'body': '', 'state': 'open', 'draft': False,
              'head': {'sha': 'a' * 40, 'repo': {'full_name': common.repository()}}, 'base': {'sha': 'b' * 40}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': kind, 'GITHUB_EVENT_PATH': str(event)}), \
                patch.object(review, 'pull_request', return_value=pr), \
                patch.object(review, 'context', return_value=discussion):
            review.capture(self.root)
        return common.read_json(self.root / 'input.json')

    def test_ordinary_comment_capture_has_a_mandatory_response_target(self):
        source = self.capture_event('issue_comment', 'created', {'comments': [self.command()]})
        self.assertEqual(source['reply_targets'][0]['body'], 'it should stay there')
        self.assertIsNone(source['push_update_key'])
        self.assertIn('should_review=true', (self.root / 'outputs').read_text())
        self.assertNotIn('run_nonce=', (self.root / 'outputs').read_text())

    def test_push_capture_keys_are_stable_on_retry_but_unique_per_push(self):
        first = self.capture_event('pull_request_target', 'synchronize', {})['push_update_key']
        with patch.dict(os.environ, {'GITHUB_RUN_ATTEMPT': '2'}):
            retry = self.capture_event('pull_request_target', 'synchronize', {})['push_update_key']
        with patch.dict(os.environ, {'GITHUB_RUN_ID': '101'}):
            next_push = self.capture_event('pull_request_target', 'synchronize', {})['push_update_key']
        self.assertEqual(first, retry)
        self.assertNotEqual(first, next_push)
        self.assertIsNone(self.capture_event('pull_request_target', 'opened', {})['push_update_key'])

    def test_bot_comments_still_do_not_start_reviews(self):
        event = self.root / 'event.json'
        common.write_json(event, {'issue': {'number': 7, 'pull_request': {'url': 'pr'}},
                                 'action': 'created', 'comment': {'body': 'bot review'},
                                 'sender': {'login': 'github-actions[bot]', 'type': 'Bot'}})
        pr = {'state': 'open', 'draft': False, 'head': {'repo': {'full_name': common.repository()}}}
        with patch.dict(os.environ, {'GITHUB_EVENT_PATH': str(event)}), \
                patch.object(review, 'pull_request', return_value=pr), patch.object(review, 'api') as api:
            review.prepare(self.root)
        self.assertNotIn('mode=review', (self.root / 'outputs').read_text())
        api.assert_not_called()

    def test_finish_preserves_push_update_for_the_publisher(self):
        key = common.fingerprint({'push': 100})
        common.write_json(self.root / 'input.json', {'number': 7, 'head_sha': 'a' * 40,
                          'base_sha': 'b' * 40, 'changed_files': 1, 'run_nonce': 'current',
                          'reply_targets': [], 'push_update_key': key})
        common.write_json(self.root / 'resume.json', {'resumed': True})
        common.write_json(self.root / 'goose-review.json', fixtures.completed())
        (self.root / 'inline.diff').write_text('')
        with patch.dict(os.environ, {'RUNNER_TEMP': str(self.root)}), \
                patch.object(sys, 'argv', ['review.py', 'finish', '0', '1']), \
                patch.object(review, 'usage_since', return_value={'cost_usd': 0}):
            review.finish(self.root)
        self.assertEqual(common.read_json(self.root / 'result.json')['push_update_key'], key)

    def test_targets_deduplicate_answers_but_reopen_edited_comments(self):
        command = self.command()
        discussion = {'comments': [command], 'reviews': [], 'threads': []}
        targets = review.reply_targets(discussion)
        self.assertEqual([target['comment_id'] for target in targets], ['IC_test'])
        marker = common.REPLY_PREFIX + targets[0]['version_key'] + ' -->'
        discussion['previous_ai_responses'] = [{'body': marker + '\nAnswered'}]
        self.assertEqual(review.reply_targets(discussion), [])
        command['body'] += ' because this is intentional'
        self.assertEqual(len(review.reply_targets(discussion)), 1)

    def test_ordinary_inline_and_review_comments_are_also_reply_targets(self):
        discussion = {'comments': [], 'reviews': [self.command('check this', 'review')],
                      'threads': [{'comments': {'nodes': [self.command('why?', 'inline') | {'url': 'https://github.com/pcace/RoadbookNavi/pull/7#discussion_r123'}]}}]}
        self.assertEqual({item['comment_id'] for item in review.reply_targets(discussion)}, {'review', 'inline'})

    def test_ordinary_statement_cannot_finish_without_a_response(self):
        targets = review.reply_targets({'comments': [self.command()]})
        with self.assertRaisesRegex(common.ReviewError, 'comment_response_missing'):
            review.final_answer(fixtures.completed(), 'current', targets)
        response = {'comment_id': 'IC_test', 'response': 'Understood. This is intentional, so I withdraw the unsupported cleanup finding.'}
        answer, replies, _, _ = review.final_answer(fixtures.completed(responses=[response]), 'current', targets)
        self.assertEqual(answer, fixtures.ANSWER)
        self.assertEqual(replies[0]['version_key'], targets[0]['version_key'])

    def test_response_ids_and_fresh_final_tool_payload_must_match(self):
        targets = review.reply_targets({'comments': [self.command()]})
        for response in ({'comment_id': 'wrong', 'response': 'A sufficiently long answer.'},
                         {'comment_id': 'IC_test', 'response': 'OK'}):
            with self.subTest(response=response), self.assertRaisesRegex(common.ReviewError, 'comment_response_invalid'):
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
        with self.assertRaisesRegex(common.ReviewError, 'comment_response_invalid'):
            review.final_answer(fixtures.completed(responses=[response, response]), 'current', targets)

    def test_inline_listener_without_unanswered_comments_does_not_start_the_model(self):
        event = self.root / 'event.json'
        common.write_json(event, {})
        pr = {'state': 'open', 'draft': False, 'head': {'repo': {'full_name': common.repository()}}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'workflow_run', 'GITHUB_EVENT_PATH': str(event)}), \
                patch.object(review, 'pull_request', return_value=pr), \
                patch.object(review, 'context', return_value={'comments': []}):
            review.capture(self.root)
        self.assertIn('should_review=false', (self.root / 'outputs').read_text())
        self.assertFalse((self.root / 'input.json').exists())

    def test_failed_publication_is_not_hidden_by_unchanged_fingerprint(self):
        self.assert_unchanged_input_runs(review.reply_targets({'comments': [self.command()]}))

    def test_push_event_is_not_suppressed_by_unchanged_fingerprint(self):
        self.assert_unchanged_input_runs([], 'c' * 64)

    def assert_unchanged_input_runs(self, targets, push_key=None):
        source = {'number': 7, 'head_sha': 'a' * 40, 'base_sha': 'b' * 40, 'title': 'Fix',
                  'description': '', 'focus': '', 'force_review': False, 'input_fingerprint': 'same',
                  'reply_targets': targets, 'push_update_key': push_key}
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

    def test_publisher_skips_comments_edited_or_deleted_during_review(self):
        self.publication()
        for commands in ([], [self.command('/review changed request')]):
            with self.subTest(commands=commands):
                self.assertEqual(len(self.publish_with({'comments': commands}, [])), 1)

    def push_publication(self, key='c' * 64):
        result = self.publication()
        result.update(responses=[], push_update_key=key)
        common.write_json(self.root / 'result.json', result)
        return {'id': 1, 'body': common.MARKER + '\nOld summary',
                'user': {'login': 'github-actions[bot]', 'type': 'Bot'}}

    def test_push_posts_visible_review_even_without_any_pending_comments(self):
        summary = self.push_publication()
        calls = self.publish_with({}, [summary])
        self.assertEqual([call.kwargs['method'] for call in calls], ['PATCH', 'POST'])
        body = calls[1].kwargs['payload']['body']
        self.assertIn(common.PUSH_PREFIX, body)
        self.assertIn('AI review after push', body)
        self.assertIn(fixtures.ANSWER, body)
        self.assertIn('a' * 40, body)

    def test_same_push_retry_does_not_duplicate_visible_update(self):
        summary = self.push_publication()
        existing = {'id': 2, 'body': common.PUSH_PREFIX + 'c' * 64 + ' -->\nOld update',
                    'user': {'login': 'github-actions[bot]', 'type': 'Bot'}}
        self.assertEqual(len(self.publish_with({}, [summary, existing])), 1)
        self.push_publication('d' * 64)
        self.assertEqual(len(self.publish_with({}, [summary, existing])), 2)

    def test_invalid_push_marker_fails_before_any_publication(self):
        summary = self.push_publication('invalid')
        with self.assertRaisesRegex(common.ReviewError, 'invalid_push_update_key'):
            self.publish_with({}, [summary])

    def test_push_and_comment_responses_are_both_published(self):
        result = self.publication()
        result['push_update_key'] = 'c' * 64
        common.write_json(self.root / 'result.json', result)
        calls = self.publish_with({'comments': [self.command()]}, [])
        self.assertEqual(len(calls), 3)  # Summary, push result, human response.
        self.assertIn(common.PUSH_PREFIX, calls[1].kwargs['payload']['body'])
        self.assertIn(common.REPLY_PREFIX, calls[2].kwargs['payload']['body'])
