# SPDX-License-Identifier: GPL-3.0-only
"""Regression tests for stale-head continuations and fresh evidence delivery."""

import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import common
import freshness
import review
import test_review as fixtures


class FreshnessTests(unittest.TestCase):
    tearDown = fixtures.ReviewTests.tearDown

    def setUp(self):
        fixtures.ReviewTests.setUp(self)
        self.source = {'number': 7, 'head_sha': 'a' * 40, 'base_sha': 'b' * 40,
                       'run_nonce': 'current', 'changed_files': 1, 'reply_targets': []}
        self.followup = {'incremental_diff_available': True, 'resumed': True,
                         'previous_head': 'c' * 40, 'base_changed': False, 'history_rewritten': False}
        for name in freshness.TASK_FILES:
            (self.root / name).write_text('+new code\n' if name.endswith('.diff') else '{}\n')
        freshness.freeze_task(self.root, self.source, self.followup)
        common.write_json(self.root / 'input.json', self.source)
        common.write_json(self.root / 'resume.json', {'resumed': True})

    def completed(self):
        value = fixtures.completed()
        task = freshness.task_directory(self.root, self.source)
        stdout = ((task / 'context.json').read_text()
                  + (task / self.source['task_diff']).read_bytes()[:freshness.BOOTSTRAP_BYTES].decode(errors='replace'))
        value['messages'][1:1] = [
            {'role': 'assistant', 'content': [{'type': 'toolRequest', 'id': 'fresh-read', 'toolCall': {
                'value': {'name': 'shell', 'arguments': {'command': freshness.read_command(self.root, self.source)}}}}]},
            {'role': 'user', 'content': [{'type': 'toolResponse', 'id': 'fresh-read', 'toolResult': {
                'status': 'success', 'value': {'isError': False,
                    'structuredContent': {'exit_code': 0, 'stdout': stdout}}}}]},
        ]
        return value

    def verify(self, value):
        freshness.verify_task_read(self.root, review.current_messages(value, 'current'), self.source)

    def test_fresh_context_and_diff_preview_are_accepted(self):
        self.verify(self.completed())

    def test_current_head_and_previous_head_are_distinct_in_new_prompt(self):
        prompt = (self.root / 'task-summary.txt').read_text()
        self.assertIn('CURRENT HEAD: ' + 'a' * 40, prompt)
        self.assertIn('PREVIOUS HEAD (historical): ' + 'c' * 40, prompt)
        self.assertIn('/review-input/task-current/', prompt)

    def test_multiline_task_parameter_stays_inside_yaml_prompt(self):
        recipe = Path(__file__).with_name('recipe.yaml').read_text()
        self.assertIn('  {{ task | indent(2) }}\n', recipe)

    def test_context_is_immutable_when_root_evidence_changes(self):
        (self.root / 'since-last-review.diff').write_text('changed after snapshot')
        task = freshness.task_directory(self.root, self.source)
        self.assertEqual((task / 'since-last-review.diff').read_text(), '+new code\n')

    def test_missing_or_historical_read_does_not_validate_new_answer(self):
        for messages in (fixtures.completed()['messages'],
                         self.completed()['messages'] + fixtures.completed('next')['messages']):
            nonce = 'next' if len(messages) > 4 else 'current'
            with self.assertRaisesRegex(common.ReviewError, 'current_context_read_missing'):
                freshness.verify_task_read(self.root, review.current_messages({'messages': messages}, nonce), self.source)

    def test_skipping_diff_or_reading_old_path_is_rejected(self):
        for command in ('cat /review-input/followup.json',
                        'cat -- /review-input/task-current/context.json',
                        freshness.read_command(self.root, self.source).replace('task-current', 'task-old')):
            value = self.completed()
            value['messages'][1]['content'][0]['toolCall']['value']['arguments']['command'] = command
            with self.assertRaisesRegex(common.ReviewError, 'current_context_read_missing'):
                self.verify(value)

    def test_failed_or_replayed_output_is_rejected(self):
        for change in ('failed', 'exit', 'replayed', 'truncated'):
            value = self.completed()
            result = value['messages'][2]['content'][0]['toolResult']
            if change == 'failed':
                result['value']['isError'] = True
            elif change == 'exit':
                result['value']['structuredContent']['exit_code'] = 1
            elif change == 'replayed':
                result['value']['structuredContent']['stdout'] = result['value']['structuredContent']['stdout'].replace('a' * 40, 'c' * 40)
            else:
                result['value']['structuredContent']['stdout'] = '{}\n'
            with self.subTest(change=change), self.assertRaisesRegex(common.ReviewError, 'current_context_read_missing'):
                self.verify(value)

    def test_read_after_final_output_is_rejected(self):
        value = self.completed()
        value['messages'][1:4] = [value['messages'][3], value['messages'][1], value['messages'][2]]
        with self.assertRaisesRegex(common.ReviewError, 'current_context_read_missing'):
            self.verify(value)

    def test_empty_incremental_diff_still_requires_new_context(self):
        task = freshness.task_directory(self.root, self.source)
        (task / 'since-last-review.diff').write_text('')
        self.verify(self.completed())

    def test_first_review_or_missing_previous_commit_uses_full_diff(self):
        for nonce, resumed in (('first', False), ('missing', True)):
            source = dict(self.source, run_nonce=nonce)
            freshness.freeze_task(self.root, source,
                                  dict(self.followup, incremental_diff_available=False, resumed=resumed))
            self.assertEqual(source['task_diff'], 'pr.diff')
            self.assertIn('/pr.diff', freshness.read_command(self.root, source))

    def test_changed_base_or_rewritten_history_bootstraps_full_scope(self):
        for nonce, flag in (('base', 'base_changed'), ('rewrite', 'history_rewritten')):
            source = dict(self.source, run_nonce=nonce)
            freshness.freeze_task(self.root, source, dict(self.followup, **{flag: True}))
            self.assertEqual(source['task_diff'], 'pr.diff')

    def test_context_preview_is_bounded_but_full_diff_remains_available(self):
        task = freshness.task_directory(self.root, self.source)
        content = '+new code\n' * 3000
        (task / 'since-last-review.diff').write_text(content)
        value = self.completed()
        self.verify(value)
        output = value['messages'][2]['content'][0]['toolResult']['value']['structuredContent']['stdout']
        self.assertLess(len(output), len(content))
        self.assertEqual((task / 'since-last-review.diff').read_text(), content)

    def test_invalid_nonce_cannot_escape_input_directory(self):
        for nonce in ('../../elsewhere', 'shell;command', '', None):
            with self.assertRaisesRegex(common.ReviewError, 'invalid_run_nonce'):
                freshness.task_directory(self.root, dict(self.source, run_nonce=nonce))

    def test_previous_commit_final_output_is_rejected(self):
        with self.assertRaisesRegex(common.ReviewError, 'reviewed_head_mismatch'):
            review.final_answer(fixtures.completed(head_sha='c' * 40), 'current', head_sha='a' * 40)

    def test_finish_rejects_stale_read_without_saving_success(self):
        common.write_json(self.root / 'goose-review.json', fixtures.completed())
        with patch.dict(os.environ, {'RUNNER_TEMP': str(self.root)}), \
                patch.object(sys, 'argv', ['review.py', 'finish', '0', '1']):
            with self.assertRaisesRegex(common.ReviewError, 'current_context_read_missing'):
                review.finish(self.root)
        self.assertFalse((self.root / 'result.json').exists())
        self.assertEqual(common.read_json(self.root / 'diagnostics.json')['failure'], 'current_context_read_missing')

    def test_finish_accepts_verified_new_head_and_context(self):
        common.write_json(self.root / 'goose-review.json', self.completed())
        with patch.dict(os.environ, {'RUNNER_TEMP': str(self.root)}), \
                patch.object(sys, 'argv', ['review.py', 'finish', '0', '1']), \
                patch.object(review, 'usage_since', return_value={'cost_usd': 0}):
            review.finish(self.root)
        self.assertEqual(common.read_json(self.root / 'result.json')['head_sha'], 'a' * 40)
