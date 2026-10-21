# SPDX-License-Identifier: GPL-3.0-only
"""Offline regression tests for state, event trust, new completions and cleanup."""

import io
import json
import os
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).parent))
import common
import review
import session

ANSWER = ('### Findings\nNo verified findings. The existing behavior is preserved in this synthetic review.\n'
          '### Checked and limits\nChecked the changed function and its caller; no tests were run.')


def completed(nonce='current', answer=ANSWER, responses=None):
    result = {'review': answer, 'responses': responses or []}
    return {'metadata': {'status': 'completed'}, 'messages': [
        {'role': 'user', 'content': [{'type': 'text', 'text': f'Review execution: {nonce}\nTask.'}]},
        {'role': 'assistant', 'content': [{'type': 'toolRequest', 'id': nonce, 'toolCall': {
            'value': {'name': 'recipe__final_output', 'arguments': result}}}]},
        {'role': 'user', 'content': [{'type': 'toolResponse', 'id': nonce,
                                     'toolResult': {'status': 'success', 'value': {'isError': False}}}]},
        {'role': 'assistant', 'content': [{'type': 'text', 'text': json.dumps(result)}]},
    ]}


def create_database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.executescript('''
          CREATE TABLE sessions (id TEXT PRIMARY KEY, extension_data TEXT,
            recipe_json TEXT, user_recipe_values_json TEXT, system_prompt_override TEXT,
            system_prompt_extras_json TEXT, model_config_json TEXT, provider_name TEXT,
            goose_mode TEXT, container_id TEXT);
          CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT, content TEXT);
          CREATE TABLE usage_ledger (id INTEGER PRIMARY KEY, session_id TEXT, model TEXT,
            input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER,
            cost REAL, cost_source TEXT);
        ''')
        db.execute('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                   ('20261021_1', '{"todo":{"items":["keep this"]}}', '{"old":"recipe"}',
                    '{}', 'old prompt', '[]', '{}', 'old provider', 'auto', 'old-container'))
        db.execute('INSERT INTO messages VALUES (1, ?, ?)', ('20261021_1', 'original evidence'))
        db.execute('INSERT INTO usage_ledger VALUES (1, ?, ?, 100, 20, 120, 0, ?)',
                   ('20261021_1', common.MODEL, 'provider_reported'))


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.environment = patch.dict(os.environ, {
            'GITHUB_REPOSITORY': 'pcace/RoadbookNavi', 'GITHUB_RUN_ID': '100',
            'GITHUB_RUN_ATTEMPT': '1', 'GOOSE_MODEL': common.MODEL, 'GOOSE_IMAGE': 'pinned-image',
            'PR_NUMBER': '7', 'GITHUB_OUTPUT': str(self.root / 'outputs'),
            'GITHUB_EVENT_NAME': 'issue_comment', 'GITHUB_REF': 'refs/heads/main',
        })
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def checkpoint(self, number=7):
        database = self.root / 'fixture.db'
        if not database.exists():
            create_database(database)
        manifest = {**session.compatibility(), 'number': number,
                    'repository': 'pcace/RoadbookNavi', 'session_id': '20261021_1',
                    'head_sha': 'a' * 40, 'base_sha': 'b' * 40, 'merge_base_sha': 'b' * 40,
                    'database_sha256': common.digest(database.read_bytes()),
                    'run_id': '99', 'workflow_id': 123, 'input_fingerprint': 'old'}
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            archive.writestr('manifest.json', json.dumps(manifest))
            archive.writestr('sessions.db', database.read_bytes())
            archive.writestr('discussion.json', json.dumps({'comments': [], 'reviews': [], 'threads': []}))
            archive.writestr('result.json', json.dumps({'review': ANSWER}))
        return stream.getvalue()

    def test_only_a_fresh_accepted_final_output_counts(self):
        value = completed('old')
        value['messages'] += completed()['messages']
        self.assertEqual(review.final_answer(value, 'current'), (ANSWER, []))
        value['messages'] = completed('old')['messages'] + completed()['messages'][:1]
        with self.assertRaisesRegex(common.ReviewError, 'final_answer_missing'):
            review.final_answer(value, 'current')

    def test_old_tool_result_cannot_validate_fresh_plain_text(self):
        value = completed('old')
        current = completed()['messages']
        value['messages'] += [current[0], current[-1]]
        with self.assertRaisesRegex(common.ReviewError, 'new_final_output_missing'):
            review.final_answer(value, 'current')

    def test_missing_run_boundary_and_rejected_tool_fail(self):
        with self.assertRaisesRegex(common.ReviewError, 'current_run_boundary_missing'):
            review.final_answer(completed('old'), 'current')
        value = completed()
        value['messages'][2]['content'][0]['toolResult']['value']['isError'] = True
        with self.assertRaisesRegex(common.ReviewError, 'new_final_output_missing'):
            review.final_answer(value, 'current')

    def test_rewritten_or_incomplete_answer_fails(self):
        value = completed()
        value['metadata']['status'] = 'error'
        with self.assertRaisesRegex(common.ReviewError, 'goose_incomplete'):
            review.final_answer(value, 'current')
        value = completed()
        value['messages'][-1]['content'][0]['text'] = json.dumps({'review': ANSWER + ' changed'})
        with self.assertRaisesRegex(common.ReviewError, 'new_final_output_missing'):
            review.final_answer(value, 'current')

    def test_discussion_diff_includes_edits_deletions_and_thread_resolution(self):
        old = {'comments': [{'id': '1', 'body': 'before'}, {'id': '2', 'body': 'removed'}],
               'threads': [{'id': 't', 'isResolved': False}]}
        new = {'comments': [{'id': '1', 'body': 'after'}], 'threads': [{'id': 't', 'isResolved': True}]}
        delta = review.discussion_delta(old, new)
        self.assertEqual(len(delta['new_or_updated']), 2)
        self.assertEqual(delta['removed_ids'], ['comments:2'])

    def test_own_review_and_capture_time_do_not_change_input_fingerprint(self):
        old = {'comments': [], 'reviews': [], 'threads': [], 'captured_at': 'old', 'previous_ai_review': None}
        new = {**old, 'captured_at': 'new', 'previous_ai_review': {'body': 'updated bot review'}}
        self.assertEqual(common.fingerprint(review.discussion_evidence(old)),
                         common.fingerprint(review.discussion_evidence(new)))

    def test_graphql_paginates_connections_and_thread_comments(self):
        def page(nodes, more, cursor):
            return {'nodes': nodes, 'pageInfo': {'hasNextPage': more, 'endCursor': cursor}}
        responses = [
            {'repository': {'pullRequest': {'comments': page([{'id': '1'}], True, 'next')}}},
            {'repository': {'pullRequest': {'comments': page([{'id': '2'}], False, 'last')}}},
        ]
        with patch.object(review, 'graphql', side_effect=responses) as request:
            self.assertEqual([item['id'] for item in review.connection_pages(7, 'comments', review.COMMENT)], ['1', '2'])
            self.assertEqual(request.call_args_list[1].args[1]['after'], 'next')
        thread = {'id': 't', 'comments': page([{'id': 'a'}], True, 'next')}
        with patch.object(review, 'graphql', return_value={'node': {'comments': page([{'id': 'b'}], False, None)}}):
            self.assertEqual([item['id'] for item in review.thread_comments(thread)], ['a', 'b'])

    def test_workflow_run_requires_expected_unprivileged_listener(self):
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'workflow_run'}):
            event = {'workflow_run': {'path': common.DISCUSSION_WORKFLOW_PATH, 'conclusion': 'success',
                     'event': 'pull_request_review_comment', 'head_repository': {'full_name': common.repository()},
                     'pull_requests': [{'number': 7}], 'actor': {'login': 'pcace', 'type': 'User'}}}
            self.assertEqual(review.event_number_actor(event)[0], 7)
            event['workflow_run']['path'] = '.github/workflows/evil.yml'
            self.assertEqual(review.event_number_actor(event), (None, None))

    def test_manual_dispatch_must_use_default_branch(self):
        event = {'repository': {'default_branch': 'main'}, 'inputs': {'pr_number': '7'}, 'sender': {'login': 'pcace'}}
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REF': 'refs/heads/evil'}):
            self.assertEqual(review.event_number_actor(event), (None, None))

    def test_artifact_provenance_rejects_other_workflows_and_events(self):
        artifact = {'workflow_run': {'id': 99}}
        origin = {'workflow_id': 123, 'path': common.WORKFLOW_PATH,
                  'event': 'pull_request_target', 'repository': {'full_name': common.repository()}}
        for changes, accepted in (({}, True), ({'workflow_id': 999}, False),
                                  ({'event': 'pull_request'}, False),
                                  ({'path': '.github/workflows/untrusted.yml'}, False),
                                  ({'repository': {'full_name': 'other/repo'}}, False)):
            with self.subTest(changes=changes), patch.object(common, 'api', return_value={**origin, **changes}):
                self.assertEqual(common.trusted_artifact(artifact, 123, {}), accepted)

    def test_unchanged_automatic_event_skips_before_reading_checkout(self):
        common.write_json(self.root / 'input.json', {'force_review': False, 'input_fingerprint': 'same'})
        common.write_json(self.root / 'resume.json', {'resumed': True, 'input_fingerprint': 'same'})
        with patch.object(review, 'git') as git:
            review.collect(self.root)
            git.assert_not_called()
        self.assertIn('should_run=false', (self.root / 'outputs').read_text())

    def test_missing_checkpoint_starts_fresh(self):
        common.write_json(self.root / 'input.json', {'number': 7})
        with patch.object(session, 'workflow_run', return_value={'workflow_id': 123}), \
                patch.object(session, 'checkpoint_artifacts', return_value=[]):
            session.restore(self.root)
        self.assertFalse(common.read_json(self.root / 'resume.json')['resumed'])

    def test_api_ignores_only_explicitly_allowed_missing_artifacts(self):
        response = subprocess.CompletedProcess([], 1, stdout=b'', stderr=b'gh: Not Found (HTTP 404)')
        with patch.object(common.subprocess, 'run', return_value=response):
            self.assertEqual(common.api('artifact', binary=True, allow_missing=True), b'')
            with self.assertRaisesRegex(common.ReviewError, 'github_api_failed'):
                common.api('artifact', binary=True)

    def test_merged_pr_cleanup_does_not_require_human_actor(self):
        event = {'pull_request': {'number': 7}, 'sender': {'login': 'github-actions[bot]', 'type': 'Bot'}}
        event_file = self.root / 'event.json'
        common.write_json(event_file, event)
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'pull_request_target', 'GITHUB_EVENT_PATH': str(event_file)}), \
                patch.object(review, 'pull_request', return_value={'merged': True, 'head': {'repo': {'full_name': common.repository()}}}), \
                patch.object(review, 'api') as api:
            review.prepare(self.root)
            self.assertIn('mode=cleanup', (self.root / 'outputs').read_text())
            api.assert_not_called()

    def test_checkpoint_rejects_wrong_pr_and_tampering(self):
        with self.assertRaisesRegex(common.ReviewError, 'checkpoint_pr_mismatch'):
            session.decode_checkpoint(self.checkpoint(8), 7)
        manifest, contents = session.decode_checkpoint(self.checkpoint(), 7)
        self.assertEqual(manifest['session_id'], '20261021_1')
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            for name, value in contents.items():
                archive.writestr(name, b'changed' if name == 'sessions.db' else value)
        with self.assertRaisesRegex(common.ReviewError, 'checkpoint_checksum_mismatch'):
            session.decode_checkpoint(stream.getvalue(), 7)

    def test_checkpoint_rejects_extra_paths_and_symlinks(self):
        for symlink in (False, True):
            stream = io.BytesIO(self.checkpoint())
            with zipfile.ZipFile(stream, 'a') as archive:
                if symlink:
                    info = zipfile.ZipInfo('../escape')
                    info.external_attr = (stat.S_IFLNK | 0o777) << 16
                    archive.writestr(info, 'target')
                else:
                    archive.writestr('../escape', 'bad')
            with self.assertRaisesRegex(common.ReviewError, 'invalid_checkpoint_members'):
                session.decode_checkpoint(stream.getvalue(), 7)

    def test_checkpoint_rejects_invalid_json_object_types(self):
        _, original = session.decode_checkpoint(self.checkpoint(), 7)
        for name in ('manifest.json', 'discussion.json', 'result.json'):
            with self.subTest(name=name):
                stream = io.BytesIO()
                with zipfile.ZipFile(stream, 'w') as archive:
                    for key, value in original.items():
                        archive.writestr(key, b'[]' if key == name else value)
                with self.assertRaises(common.ReviewError):
                    session.decode_checkpoint(stream.getvalue(), 7)

    def test_restore_falls_back_without_losing_history_or_todo(self):
        common.write_json(self.root / 'input.json', {'number': 7})
        artifacts = [{'id': 2, 'workflow_run': {'id': 98}}, {'id': 1, 'workflow_run': {'id': 99}}]
        good = self.checkpoint()
        with patch.object(session, 'workflow_run', return_value={'workflow_id': 123}), \
                patch.object(session, 'checkpoint_artifacts', return_value=artifacts), \
                patch.object(session, 'trusted_artifact', return_value=True), \
                patch.object(session, 'api', side_effect=[b'corrupt', good]):
            session.restore(self.root)
        baseline = common.read_json(self.root / 'resume.json')
        self.assertTrue(baseline['resumed'])
        self.assertEqual(baseline['artifact_id'], 1)
        with session.connect_readonly(session.state_database(self.root)) as db:
            self.assertEqual(db.execute('SELECT content FROM messages').fetchone()[0], 'original evidence')
            row = db.execute('SELECT extension_data, recipe_json, system_prompt_override FROM sessions').fetchone()
            self.assertIn('keep this', row[0])
            self.assertEqual(row[1:], (None, None))

    def test_usage_only_counts_new_requests(self):
        database = session.state_database(self.root)
        create_database(database)
        with sqlite3.connect(database) as db:
            db.execute('INSERT INTO usage_ledger VALUES (2, ?, ?, 10, 2, 12, 0, ?)',
                       ('20261021_1', common.MODEL, 'provider_reported'))
        usage = session.usage_since(self.root, {'session_id': '20261021_1', 'last_usage_id': 1})
        self.assertEqual((usage['total_tokens'], usage['model_requests'], usage['cost_usd']), (12, 1, 0))

    def test_nonzero_cost_fails_closed(self):
        database = session.state_database(self.root)
        create_database(database)
        with sqlite3.connect(database) as db:
            db.execute('UPDATE usage_ledger SET cost=0.01')
        with self.assertRaisesRegex(common.ReviewError, 'nonzero_cost_on_free_model'):
            session.usage_since(self.root, {'last_usage_id': 0})

    def test_snapshot_and_restore_round_trip(self):
        create_database(session.state_database(self.root))
        common.write_json(self.root / 'input.json', {'number': 7, 'head_sha': 'a' * 40,
                          'base_sha': 'b' * 40, 'merge_base_sha': 'b' * 40, 'input_fingerprint': 'fp'})
        common.write_json(self.root / 'result.json', {'review': ANSWER})
        common.write_json(self.root / 'resume.json', {'resumed': False})
        common.write_json(self.root / 'discussion.json', {'comments': []})
        with patch.object(session, 'pull_request', return_value={'merged': False}), \
                patch.object(session, 'workflow_run', return_value={'workflow_id': 123}):
            session.snapshot(self.root)
        self.assertIn('should_save=true', (self.root / 'outputs').read_text())
        with session.connect_readonly(self.root / 'checkpoint/sessions.db') as db:
            self.assertEqual(db.execute('SELECT content FROM messages').fetchone()[0], 'original evidence')

    def test_merge_during_review_prevents_new_checkpoint(self):
        common.write_json(self.root / 'input.json', {'number': 7})
        common.write_json(self.root / 'result.json', {})
        common.write_json(self.root / 'resume.json', {})
        with patch.object(session, 'pull_request', return_value={'merged': True}):
            session.snapshot(self.root)
        self.assertFalse((self.root / 'checkpoint').exists())

    def test_oversized_discussion_is_not_uploaded_as_a_checkpoint(self):
        create_database(session.state_database(self.root))
        common.write_json(self.root / 'input.json', {'number': 7, 'head_sha': 'a' * 40,
                          'base_sha': 'b' * 40, 'merge_base_sha': 'b' * 40, 'input_fingerprint': 'fp'})
        common.write_json(self.root / 'result.json', {'review': ANSWER})
        common.write_json(self.root / 'resume.json', {'resumed': False})
        common.write_json(self.root / 'discussion.json', {'comments': ['x' * 8_000_000]})
        with patch.object(session, 'pull_request', return_value={'merged': False}), \
                patch.object(session, 'workflow_run', return_value={'workflow_id': 123}):
            with self.assertRaisesRegex(common.ReviewError, 'checkpoint_payload_too_large'):
                session.snapshot(self.root)
        self.assertNotIn('should_save=true', (self.root / 'outputs').read_text())

    def test_cleanup_only_deletes_this_pr_from_this_workflow(self):
        items = [
            {'id': 1, 'name': 'ai-review-session-pr-7-run-99-attempt-1'},
            {'id': 2, 'name': 'ai-review-result-pr-7-run-99-attempt-1'},
            {'id': 3, 'name': 'ai-review-session-pr-70-run-99-attempt-1'},
            {'id': 4, 'name': 'ai-review-session-pr-7-run-98-attempt-1'},
            {'id': 5, 'name': 'normal-ci-artifact'},
        ]
        with patch.object(session, 'pull_request', return_value={'merged': True}), \
                patch.object(session, 'workflow_run', return_value={'workflow_id': 123}), \
                patch.object(session, 'pages', side_effect=[iter(items), iter([items[2], items[3], items[4]])]), \
                patch.object(session, 'trusted_artifact', side_effect=lambda item, *_: item['id'] != 4), \
                patch.object(session, 'api', return_value=b'{}') as api:
            session.cleanup(self.root)
        deleted = [call.args[0] for call in api.call_args_list if call.kwargs.get('method') == 'DELETE']
        self.assertEqual(deleted, ['repos/pcace/RoadbookNavi/actions/artifacts/1',
                                   'repos/pcace/RoadbookNavi/actions/artifacts/2'])

    def test_closed_without_merge_keeps_memory(self):
        with patch.object(session, 'pull_request', return_value={'merged': False}), patch.object(session, 'pages') as pages:
            session.cleanup(self.root)
            pages.assert_not_called()

    def test_wrong_model_and_changed_pricing_are_rejected(self):
        with patch.dict(os.environ, {'GOOSE_MODEL': 'openrouter/free'}):
            with self.assertRaisesRegex(common.ReviewError, 'only_fixed_free_model_allowed'):
                review.check_model(self.root)
        value = {'data': [{'id': common.MODEL, 'supported_parameters': ['tools'],
                           'pricing': {'prompt': '0.01', 'completion': '0'}}]}
        response = io.BytesIO(json.dumps(value).encode())
        with patch.object(review, 'urlopen', return_value=response):
            with self.assertRaisesRegex(common.ReviewError, 'free_model_unavailable_or_priced'):
                review.check_model(self.root)


class GitDiffTests(unittest.TestCase):
    def test_collects_incremental_diff_after_history_rewrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            checkout = root / 'repository'
            checkout.mkdir()
            def git(*args):
                return subprocess.check_output(['git', '-C', str(checkout), *args], stderr=subprocess.DEVNULL).decode().strip()
            git('init', '--quiet')
            git('config', 'user.email', 'test@example.invalid')
            git('config', 'user.name', 'Offline test')
            (checkout / 'logic.txt').write_text('base\n')
            git('add', '.')
            git('commit', '-qm', 'base')
            base = git('rev-parse', 'HEAD')
            (checkout / 'logic.txt').write_text('old implementation\n')
            git('commit', '-qam', 'old')
            previous = git('rev-parse', 'HEAD')
            git('switch', '-qc', 'rewritten', base)
            (checkout / 'logic.txt').write_text('fixed implementation\n')
            git('commit', '-qam', 'new')
            head = git('rev-parse', 'HEAD')
            data = root / 'review'
            data.mkdir()
            common.write_json(data / 'input.json', {'number': 7, 'head_sha': head, 'base_sha': base,
                'title': 'Fix', 'description': '', 'focus': '', 'force_review': False, 'input_fingerprint': 'new'})
            common.write_json(data / 'resume.json', {'resumed': True, 'reason': 'restored',
                'head_sha': previous, 'base_sha': base, 'input_fingerprint': 'old'})
            for name in ('discussion.json', 'previous-discussion.json'):
                common.write_json(data / name, {'comments': [], 'reviews': [], 'threads': []})
            with patch.dict(os.environ, {'GITHUB_WORKSPACE': str(root), 'GITHUB_OUTPUT': str(root / 'outputs')}):
                review.collect(data)
            self.assertTrue(common.read_json(data / 'followup.json')['history_rewritten'])
            incremental = (data / 'since-last-review.diff').read_text()
            self.assertIn('-old implementation', incremental)
            self.assertIn('+fixed implementation', incremental)
            self.assertEqual(common.read_json(data / 'input.json')['merge_base_sha'], base)


if __name__ == '__main__':
    unittest.main()
