# SPDX-License-Identifier: GPL-3.0-only
"""Offline regression tests for private provider failures and visible notices."""

import io
import json
import os
import sys
import unittest
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import common
import diagnostics
import review
import provider_probe
import test_review as fixtures


class DiagnosticsTests(unittest.TestCase):
    setUp = fixtures.ReviewTests.setUp
    tearDown = fixtures.ReviewTests.tearDown

    def pr(self):
        return {'state': 'open', 'draft': False,
                'head': {'sha': 'a' * 40, 'repo': {'full_name': 'pcace/RoadbookNavi'}}}

    def test_categories_are_fixed_and_do_not_expose_private_errors(self):
        for message, status, expected in (
            ('Rate limit exceeded: free-models-per-day. secret token', 429, 'free_daily_quota_exhausted'),
            ('daily quota exhausted', None, 'free_daily_quota_exhausted'),
            ('Too many requests', None, 'provider_rate_limited'),
            ('HTTP 401 private response', None, 'authentication_failed'),
            ('Insufficient credits', None, 'provider_credit_limit'),
            ('error', 503, 'provider_unavailable'),
            ('maximum context length exceeded', None, 'context_limit'),
            ('Could not connect to openrouter.ai', None, 'network_or_tls_error'),
            ('private prompt and API key', None, 'goose_process_failed'),
        ):
            with self.subTest(expected=expected):
                self.assertEqual(diagnostics.category(message, status), expected)

    def test_finish_classifies_stderr_but_never_serializes_it(self):
        (self.root / 'goose-review.stderr').write_text(
            'Error: Rate limit exceeded: free-models-per-day; PRIVATE_API_KEY PRIVATE_CODE')
        with patch.dict(os.environ, {'RUNNER_TEMP': str(self.root)}), \
                patch.object(sys, 'argv', ['review.py', 'finish', '1', '14']):
            with self.assertRaisesRegex(common.ReviewError, 'free_daily_quota_exhausted'):
                review.finish(self.root)
        report = common.read_json(self.root / 'diagnostics.json')
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['exit_code'], 1)
        self.assertNotIn('PRIVATE', json.dumps(report))
        self.assertFalse((self.root / 'result.json').exists())

    def test_missing_or_symlinked_stderr_is_generic(self):
        self.assertEqual(diagnostics.process_failure(self.root), 'goose_process_failed')
        secret = self.root / 'secret'
        secret.write_text('daily quota')
        (self.root / 'goose-review.stderr').symlink_to(secret)
        self.assertEqual(diagnostics.process_failure(self.root), 'goose_process_failed')

    def test_timeout_remains_distinct(self):
        with patch.dict(os.environ, {'RUNNER_TEMP': str(self.root)}), \
                patch.object(sys, 'argv', ['review.py', 'finish', '124', '900']):
            with self.assertRaisesRegex(common.ReviewError, 'timeout'):
                review.finish(self.root)

    def test_failure_notice_does_not_replace_success_or_leak_error(self):
        common.write_json(self.root / 'diagnostics.json',
                          {'status': 'failed', 'failure': 'free_daily_quota_exhausted'})
        with patch.dict(os.environ, {'HEAD_SHA': 'a' * 40, 'GITHUB_SERVER_URL': 'https://github.com'}), \
                patch.object(review, 'pull_request', return_value=self.pr()), \
                patch.object(review, 'pages', return_value=iter([])), \
                patch.object(review, 'api') as api:
            review.publish_failure(self.root)
        self.assertEqual(api.call_count, 1)
        self.assertEqual(api.call_args.kwargs['method'], 'POST')
        body = api.call_args.kwargs['payload']['body']
        self.assertIn('daily allowance', body)
        self.assertIn('last successful session is preserved', body)
        self.assertIn('actions/runs/100', body)
        self.assertNotIn(common.MARKER, body)
        self.assertNotIn(common.REPLY_PREFIX, body)

    def test_failure_notice_skips_changed_or_closed_pr_and_deduplicates(self):
        common.write_json(self.root / 'diagnostics.json', {'status': 'failed', 'failure': 'timeout'})
        duplicate = {'user': {'type': 'Bot', 'login': 'github-actions[bot]'},
                     'body': '<!-- roadbooknavi-ai-pr-failure:100 -->\nPrevious failure'}
        for pr, comments in ((self.pr() | {'state': 'closed'}, []),
                             (self.pr() | {'head': {'sha': 'b' * 40}}, []),
                             (self.pr(), [duplicate])):
            with patch.dict(os.environ, {'HEAD_SHA': 'a' * 40, 'GITHUB_SERVER_URL': 'https://github.com'}), \
                    patch.object(review, 'pull_request', return_value=pr), \
                    patch.object(review, 'pages', return_value=iter(comments)), \
                    patch.object(review, 'api') as api:
                review.publish_failure(self.root)
                api.assert_not_called()

    def test_untrusted_failure_text_is_not_published(self):
        common.write_json(self.root / 'diagnostics.json',
                          {'status': 'failed', 'failure': 'PRIVATE_CODE @someone'})
        with patch.dict(os.environ, {'HEAD_SHA': 'a' * 40, 'GITHUB_SERVER_URL': 'https://github.com'}), \
                patch.object(review, 'pull_request', return_value=self.pr()), \
                patch.object(review, 'pages', return_value=iter([])), \
                patch.object(review, 'api') as api:
            review.publish_failure(self.root)
        self.assertNotIn('PRIVATE_CODE', api.call_args.kwargs['payload']['body'])

    def test_success_report_cannot_be_used_as_failure(self):
        common.write_json(self.root / 'diagnostics.json', {'status': 'complete'})
        with patch.dict(os.environ, {'HEAD_SHA': 'a' * 40}), \
                self.assertRaisesRegex(common.ReviewError, 'failure_report_invalid'):
            review.publish_failure(self.root)

    def test_probe_keeps_fixed_free_request_and_never_returns_content(self):
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'PRIVATE_TEST_TOKEN'}), \
                patch.object(provider_probe, 'urlopen') as urlopen:
            urlopen.return_value.__enter__.return_value = io.StringIO('{"choices":["PRIVATE_ANSWER"]}')
            result = provider_probe.probe()
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(request.full_url, 'https://openrouter.ai/api/v1/chat/completions')
        self.assertEqual(payload['model'], common.MODEL)
        self.assertEqual(payload['provider']['max_price'], {'prompt': 0, 'completion': 0})
        self.assertEqual(result['category'], 'provider_available')
        self.assertNotIn('PRIVATE', json.dumps(result))

    def test_probe_reports_daily_quota_and_only_numeric_headers(self):
        error = HTTPError('https://openrouter.ai/api/v1/chat/completions', 429, 'PRIVATE',
                          {'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1792627200000',
                           'Retry-After': 'PRIVATE_PROVIDER_DATA'},
                          io.BytesIO(b'{"error":{"message":"free-models-per-day PRIVATE_TOKEN"}}'))
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'PRIVATE_TEST_TOKEN'}), \
                patch.object(provider_probe, 'urlopen', side_effect=error):
            report = provider_probe.probe()
        self.assertEqual(report['category'], 'free_daily_quota_exhausted')
        self.assertEqual(report['http_status'], 429)
        self.assertEqual(report['x-ratelimit-remaining'], '0')
        self.assertNotIn('retry-after', report)
        self.assertNotIn('PRIVATE', json.dumps(report))

    def test_probe_handles_network_and_malformed_provider_errors_safely(self):
        for error in (URLError('PRIVATE_NETWORK_DETAILS'), TimeoutError('PRIVATE'),
                      HTTPError('https://openrouter.ai', 503, 'PRIVATE', {}, io.BytesIO(b'PRIVATE'))):
            with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'PRIVATE_TEST_TOKEN'}), \
                    patch.object(provider_probe, 'urlopen', side_effect=error):
                report = provider_probe.probe()
            self.assertNotIn('PRIVATE', json.dumps(report))
            self.assertIn(report['category'], ('network_or_tls_error', 'provider_unavailable'))

    def test_probe_rejects_embedded_errors_and_invalid_success_payloads(self):
        for payload in ('[]', '{}', 'PRIVATE', '{"error":{"message":"free-models-per-day PRIVATE"}}'):
            with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'PRIVATE_TEST_TOKEN'}), \
                    patch.object(provider_probe, 'urlopen') as urlopen:
                urlopen.return_value.__enter__.return_value = io.StringIO(payload)
                report = provider_probe.probe()
            self.assertNotEqual(report['category'], 'provider_available')
            self.assertNotIn('PRIVATE', json.dumps(report))
