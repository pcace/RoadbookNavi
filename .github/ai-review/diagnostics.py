# SPDX-License-Identifier: GPL-3.0-only
"""Reduce private Goose stderr to fixed, non-sensitive failure categories."""

from pathlib import Path
import re

FAILURES = {
    'current_context_read_missing': 'The reviewer did not read the required current-run context and diff preview. No review was accepted. Try /review again.',
    'reviewed_head_mismatch': 'The reviewer returned a different commit than the current task. No review was accepted. Try /review again.',
    'free_daily_quota_exhausted': 'OpenRouter has exhausted the daily allowance for free models. Wait for the next UTC day, then comment /review.',
    'provider_rate_limited': 'The free model is temporarily rate-limited. Try /review again later.',
    'authentication_failed': 'OpenRouter rejected authentication. Check the OPENROUTER_API_KEY repository secret.',
    'provider_credit_limit': 'OpenRouter rejected the account or key credit limit. No paid fallback was attempted.',
    'provider_unavailable': 'The free model provider is unavailable. Try /review again later.',
    'context_limit': 'The model rejected the request context length.',
    'network_or_tls_error': 'Goose could not connect to the model provider.',
    'model_unavailable': 'The fixed free model is unavailable.',
    'timeout': 'The review exceeded its execution time limit.',
    'goose_process_failed': 'Goose exited before completing a valid review.',
}


def category(message, status=None):
    text = str(message).lower()
    if 'free-models-per-day' in text or ('daily' in text and ('quota' in text or 'limit' in text)):
        return 'free_daily_quota_exhausted'
    if status == 429 or re.search(r'\b429\b|rate.limit|too many requests', text):
        return 'provider_rate_limited'
    if status == 401 or re.search(r'\b401\b|invalid api key|authentication failed', text):
        return 'authentication_failed'
    if status == 402 or re.search(r'\b402\b|insufficient credits', text):
        return 'provider_credit_limit'
    if status in (500, 502, 503, 504) or re.search(r'\b50[0234]\b', text):
        return 'provider_unavailable'
    if 'context' in text and ('length' in text or 'limit' in text):
        return 'context_limit'
    if status == 404:
        return 'model_unavailable'
    if 'could not connect' in text or 'network error' in text or 'tls error' in text:
        return 'network_or_tls_error'
    return 'goose_process_failed'


def process_failure(temp):
    path = Path(temp) / 'goose-review.stderr'
    # Never serialize excerpts, provider payloads, prompts, credentials or arbitrary strings.
    if not path.is_file() or path.is_symlink():
        return 'goose_process_failed'
    with path.open('rb') as stream:
        return category(stream.read(256_000).decode('utf-8', errors='replace'))
