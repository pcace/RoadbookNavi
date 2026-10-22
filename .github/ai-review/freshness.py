# SPDX-License-Identifier: GPL-3.0-only
"""Bind continued reviews to immutable current-run evidence, not historical reads."""

import re
import shutil

from common import ReviewError, write_json

BOOTSTRAP_BYTES = 8000
TASK_FILES = ('pr.json', 'followup.json', 'pr.diff', 'since-last-review.diff',
              'commits.json', 'discussion.json', 'discussion-changes.json')


def task_directory(root, source):
    nonce = source.get('run_nonce')
    if not isinstance(nonce, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', nonce):
        raise ReviewError('invalid_run_nonce')
    return root / ('task-' + nonce)


def read_command(root, source):
    name = task_directory(root, source).name
    diff = source.get('task_diff')
    if diff not in {'pr.diff', 'since-last-review.diff'}:
        raise ReviewError('invalid_task_diff')
    return (f'cat -- /review-input/{name}/context.json && '
            f'head -c {BOOTSTRAP_BYTES} -- /review-input/{name}/{diff}')


def freeze_task(root, source, followup):
    task = task_directory(root, source)
    task.mkdir(mode=0o700)
    for name in TASK_FILES:
        shutil.copyfile(root / name, task / name)
    write_json(task / 'reply-targets.json', source.get('reply_targets', []))
    incremental = (followup['incremental_diff_available'] and not followup['base_changed']
                   and not followup['history_rewritten'])
    source['task_diff'] = 'since-last-review.diff' if incremental else 'pr.diff'
    context = {
        'run_nonce': source['run_nonce'], 'number': source['number'],
        'head_sha': source['head_sha'], 'base_sha': source['base_sha'],
        'previous_head': followup['previous_head'], 'resumed': followup['resumed'],
        'base_changed': followup['base_changed'], 'history_rewritten': followup['history_rewritten'],
        'changed_files_in_pr': source['changed_files'], 'current_diff': source['task_diff'],
        'diff_bytes': (task / source['task_diff']).stat().st_size,
        'reply_target_ids': [item['comment_id'] for item in source.get('reply_targets', [])],
    }
    write_json(task / 'context.json', context)
    (root / 'task-summary.txt').write_text(
        f'CURRENT PR: {source["number"]}\nCURRENT HEAD: {source["head_sha"]}\n'
        f'CURRENT BASE: {source["base_sha"]}\nPREVIOUS HEAD (historical): {followup["previous_head"]}\n'
        f'CURRENT TASK DIRECTORY: /review-input/{task.name}\n'
        'Mandatory fresh context tool call (execute this exact shell command):\n'
        + read_command(root, source) + '\n'
        'This bounded diff preview is only the starting point. Read remaining relevant hunks '
        'and current implementations before finalizing. Old tool results and completed todos '
        'are historical evidence, not proof of the current head.\n', encoding='utf-8')


def verify_task_read(root, messages, source):
    """Require a successful current-run read before a final-output tool call.

    This proves delivery of fresh identity and a bounded current diff preview,
    not that the model understood it or inspected every relevant implementation.
    """
    command = read_command(root, source)
    task = task_directory(root, source)
    expected = ((task / 'context.json').read_text(encoding='utf-8')
                + (task / source['task_diff']).read_bytes()[:BOOTSTRAP_BYTES].decode('utf-8', errors='replace'))
    requests = set()
    read = False
    for message in messages:
        for block in message.get('content', []):
            if block.get('type') == 'toolRequest':
                call = block.get('toolCall', {}).get('value', {})
                if call.get('name') == 'recipe__final_output' and not read:
                    raise ReviewError('current_context_read_missing')
                if (call.get('name') in {'shell', 'developer__shell'}
                        and (call.get('arguments') or {}).get('command') == command):
                    requests.add(block.get('id'))
            elif block.get('type') == 'toolResponse' and block.get('id') in requests:
                result = block.get('toolResult') or {}
                value = result.get('value') or {}
                output = value.get('structuredContent') or {}
                if (result.get('status') == 'success' and not value.get('isError', False)
                        and output.get('exit_code') == 0 and output.get('stdout') == expected):
                    read = True
    if not read:
        raise ReviewError('current_context_read_missing')
