#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Shared host-side helpers. Never print provider errors or private API payloads."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free'
MARKER = '<!-- roadbooknavi-ai-pr-review -->'
REPLY_PREFIX = '<!-- roadbooknavi-ai-pr-response:'
PUSH_PREFIX = '<!-- roadbooknavi-ai-pr-push:'
WORKFLOW_PATH = '.github/workflows/ai-review.yml'
DISCUSSION_WORKFLOW_PATH = '.github/workflows/ai-review-discussion.yml'
SCHEMA_VERSION = 1
MAX_DATABASE = 64_000_000


class ReviewError(ValueError):
    """A fixed, non-sensitive failure code."""


def directory():
    result = Path(os.environ['RUNNER_TEMP']) / 'ai-review'
    result.mkdir(parents=True, exist_ok=True)
    return result


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def fingerprint(value):
    return digest(json.dumps(value, sort_keys=True, ensure_ascii=False).encode())


def repository():
    name = os.environ['GITHUB_REPOSITORY']
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', name):
        raise ReviewError('invalid_repository')
    return name


def pr_number(value):
    if isinstance(value, bool) or not re.fullmatch(r'[1-9][0-9]{0,9}', str(value)):
        raise ReviewError('invalid_pr_number')
    return int(value)


def api(endpoint, method='GET', payload=None, binary=False, allow_missing=False):
    command = ['gh', 'api', '--method', method, endpoint]
    encoded = None
    if payload is not None:
        command += ['--input', '-']
        encoded = json.dumps(payload).encode()
    result = subprocess.run(command, input=encoded, capture_output=True, timeout=120)
    if result.returncode:
        if allow_missing and b'(HTTP 404)' in result.stderr:
            return b'' if binary else None
        raise ReviewError('github_api_failed')
    if binary:
        return result.stdout
    return json.loads(result.stdout) if result.stdout.strip() else None


def pages(endpoint, key=None):
    separator = '&' if '?' in endpoint else '?'
    for page in range(1, 1001):
        value = api(f'{endpoint}{separator}per_page=100&page={page}')
        items = value[key] if key else value
        yield from items
        if len(items) < 100:
            return
    raise ReviewError('github_pagination_limit')


def pull_request(number):
    return api(f'repos/{repository()}/pulls/{pr_number(number)}')


def same_repository(pr):
    return ((pr.get('head', {}).get('repo') or {}).get('full_name', '').lower()
            == repository().lower())


def reviewable(pr):
    return pr.get('state') == 'open' and not pr.get('draft') and same_repository(pr)


def output(name, value):
    text = str(value).lower() if isinstance(value, bool) else str(value)
    if '\n' in text or '\r' in text:
        raise ReviewError('invalid_workflow_output')
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
        stream.write(f'{name}={text}\n')


def artifact_prefix(kind, number):
    return f'ai-review-{kind}-pr-{pr_number(number)}-run-'


def artifact_name(kind, number):
    return (artifact_prefix(kind, number) + os.environ['GITHUB_RUN_ID']
            + '-attempt-' + os.environ['GITHUB_RUN_ATTEMPT'])


def workflow_run():
    return api(f'repos/{repository()}/actions/runs/{os.environ["GITHUB_RUN_ID"]}')


def trusted_artifact(artifact, workflow_id, cache):
    run_id = (artifact.get('workflow_run') or {}).get('id')
    if not run_id:
        return False
    if run_id not in cache:
        cache[run_id] = api(f'repos/{repository()}/actions/runs/{run_id}')
    run = cache[run_id]
    return (run.get('workflow_id') == workflow_id
            and run.get('path', '').split('@')[0] == WORKFLOW_PATH
            and run.get('event') in {'pull_request_target', 'issue_comment', 'workflow_run', 'workflow_dispatch'}
            and (run.get('repository') or {}).get('full_name', '').lower() == repository().lower())


def fail(error):
    code = str(error) if isinstance(error, ReviewError) else 'automation_failed'
    print(f'AI review failed: {code}. See ai-review diagnostics.', file=__import__('sys').stderr)
