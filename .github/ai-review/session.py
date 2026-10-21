#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Restore consistent Goose SQLite checkpoints and remove PR memory after merge."""

from contextlib import closing
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import sys
import zipfile

from common import (
    MAX_DATABASE, MODEL, SCHEMA_VERSION, ReviewError, api, artifact_prefix,
    digest, directory, fail, output, pages, pr_number, pull_request, read_json,
    repository, trusted_artifact, workflow_run, write_json,
)

PAYLOAD_FILES = {'manifest.json', 'sessions.db', 'discussion.json', 'result.json'}
LEGACY_SIDECARS = {'sessions.db-wal', 'sessions.db-shm'}
SESSION_ID = re.compile(r'[A-Za-z0-9_-]{1,100}')


def compatibility():
    # Bump SCHEMA_VERSION for incompatible storage/extension-state contracts.
    # Prompt changes use the new trusted recipe, not a fresh conversation.
    return {
        'schema_version': SCHEMA_VERSION,
        'model': MODEL,
        'image': os.environ['GOOSE_IMAGE'],
    }


def state_database(root):
    return root / 'goose-state/data/goose/sessions/sessions.db'


def connect_readonly(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_DATABASE:
        raise ReviewError('invalid_session_database')
    # Use SQLite's normal read-only WAL handling for the just-finished session.
    connection = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    connection.execute('PRAGMA trusted_schema=OFF')
    if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        connection.close()
        raise ReviewError('invalid_session_database')
    return connection


def inspect_database(path, expected_id=None):
    with closing(connect_readonly(path)) as connection:
        rows = connection.execute('SELECT id FROM sessions').fetchall()
        if len(rows) != 1 or not isinstance(rows[0][0], str) or not SESSION_ID.fullmatch(rows[0][0]):
            raise ReviewError('invalid_session_identity')
        session_id = rows[0][0]
        if expected_id and session_id != expected_id:
            raise ReviewError('session_identity_mismatch')
        usage_id = connection.execute('SELECT COALESCE(MAX(id), 0) FROM usage_ledger').fetchone()[0]
        return session_id, usage_id


def checkpoint_artifacts(number):
    prefix = artifact_prefix('session', number)
    candidates = [item for item in pages(f'repos/{repository()}/actions/artifacts', 'artifacts')
                  if item.get('name', '').startswith(prefix) and not item.get('expired')]
    return sorted(candidates, key=lambda item: (item.get('created_at', ''), int(item['id'])), reverse=True)


def decode_checkpoint(blob, number):
    if len(blob) > MAX_DATABASE + 10_000_000:
        raise ReviewError('checkpoint_too_large')
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            members = archive.infolist()
            names = {item.filename for item in members}
            if (len(members) != len(names) or not PAYLOAD_FILES <= names
                    or not names <= PAYLOAD_FILES | LEGACY_SIDECARS):
                raise ReviewError('invalid_checkpoint_members')
            for member in members:
                # Old exports accidentally included SQLite's read-side helpers.
                # A nonempty WAL could contain unbacked data: never discard it.
                if member.filename == 'sessions.db-wal' and member.file_size:
                    raise ReviewError('uncheckpointed_legacy_wal')
                maximum = (32768 if member.filename == 'sessions.db-shm' else
                           MAX_DATABASE if member.filename == 'sessions.db' else
                           8_000_000 if member.filename == 'discussion.json' else 1_000_000)
                if (member.file_size > maximum or member.flag_bits & 1
                        or stat.S_ISLNK(member.external_attr >> 16)):
                    raise ReviewError('invalid_checkpoint_member')
            contents = {name: archive.read(name) for name in PAYLOAD_FILES}
        manifest = json.loads(contents['manifest.json'])
        if not isinstance(manifest, dict):
            raise ReviewError('invalid_checkpoint_manifest')
        if (not isinstance(manifest.get('repository'), str)
                or manifest['repository'].lower() != repository().lower()
                or manifest.get('number') != number):
            raise ReviewError('checkpoint_pr_mismatch')
        if any(manifest.get(key) != value for key, value in compatibility().items()):
            raise ReviewError('checkpoint_incompatible')
        if manifest.get('database_sha256') != digest(contents['sessions.db']):
            raise ReviewError('checkpoint_checksum_mismatch')
        if (not isinstance(manifest.get('session_id'), str)
                or not SESSION_ID.fullmatch(manifest['session_id'])):
            raise ReviewError('invalid_session_identity')
        for key in ('head_sha', 'base_sha', 'merge_base_sha'):
            if not isinstance(manifest.get(key), str) or not re.fullmatch(r'[0-9a-f]{40}', manifest[key]):
                raise ReviewError('invalid_checkpoint_commit')
        if any(not isinstance(json.loads(contents[name]), dict)
               for name in ('discussion.json', 'result.json')):
            raise ReviewError('invalid_checkpoint_context')
        return manifest, contents
    except (ValueError, KeyError, TypeError, zipfile.BadZipFile) as error:
        if isinstance(error, ReviewError):
            raise
        raise ReviewError('invalid_checkpoint') from None


def restore(root):
    source = read_json(root / 'input.json')
    number = pr_number(source['number'])
    baseline = {'resumed': False, 'reason': 'no_checkpoint', 'last_usage_id': 0}
    state = root / 'goose-state'
    state.mkdir(exist_ok=True)
    if list(state.iterdir()):
        raise ReviewError('restore_target_not_empty')
    current = workflow_run()
    cache = {}
    for artifact in checkpoint_artifacts(number):
        if not trusted_artifact(artifact, current['workflow_id'], cache):
            continue
        try:
            blob = api(f'repos/{repository()}/actions/artifacts/{artifact["id"]}/zip', binary=True)
            manifest, contents = decode_checkpoint(blob, number)
            if (str(manifest.get('run_id')) != str(artifact['workflow_run']['id'])
                    or manifest.get('workflow_id') != current['workflow_id']):
                raise ReviewError('checkpoint_run_mismatch')
            target = state_database(root)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents['sessions.db'])
            session_id, usage_id = inspect_database(target, manifest['session_id'])
            # History and extension_data (including todo state) survive. Saved runtime
            # configuration must never replace this run's trusted recipe/model/tools.
            with closing(sqlite3.connect(target)) as connection, connection:
                connection.execute('PRAGMA trusted_schema=OFF')
                connection.execute('''UPDATE sessions SET recipe_json=NULL,
                    user_recipe_values_json=NULL, system_prompt_override=NULL,
                    system_prompt_extras_json=NULL, model_config_json=NULL,
                    provider_name='openrouter', goose_mode='auto', container_id=NULL''')
            (root / 'previous-discussion.json').write_bytes(contents['discussion.json'])
            baseline = {**manifest, 'resumed': True, 'reason': 'checkpoint_restored',
                        'last_usage_id': usage_id, 'artifact_id': artifact['id']}
            break
        except (ReviewError, sqlite3.DatabaseError, OSError) as error:
            code = str(error) if isinstance(error, ReviewError) else 'session_database_unusable'
            print(f'Checkpoint {int(artifact["id"])} skipped: {code}.')
            baseline['reason'] = 'checkpoint_unusable'
            shutil.rmtree(state)
            state.mkdir()
            continue
    write_json(root / 'resume.json', baseline)
    print('Restored previous PR session.' if baseline['resumed'] else 'Starting a new PR session: ' + baseline['reason'] + '.')


def usage_since(root, baseline):
    database = state_database(root)
    session_id, _ = inspect_database(database, baseline.get('session_id'))
    with closing(connect_readonly(database)) as connection:
        connection.row_factory = sqlite3.Row
        rows = [dict(row) for row in connection.execute(
            '''SELECT input_tokens, output_tokens, total_tokens, cost, cost_source, model
               FROM usage_ledger WHERE session_id=? AND id>? ORDER BY id''',
            (session_id, baseline['last_usage_id']))]
    if not rows:
        raise ReviewError('new_usage_missing')
    result = {'session_id': session_id, 'model_requests': len(rows),
              'actual_models': sorted({row['model'] for row in rows if row['model']})}
    for key in ('input_tokens', 'output_tokens', 'total_tokens', 'cost'):
        if all(type(row[key]) in (int, float) and row[key] >= 0 for row in rows):
            result['cost_usd' if key == 'cost' else key] = sum(row[key] for row in rows)
    if result.get('cost_usd', 0) > 0:
        raise ReviewError('nonzero_cost_on_free_model')
    result['cost_source'] = ('provider_reported' if all(row['cost_source'] == 'provider_reported' for row in rows)
                             else 'goose')
    return result


def snapshot(root):
    source = read_json(root / 'input.json')
    result = read_json(root / 'result.json')
    baseline = read_json(root / 'resume.json')
    output('should_save', False)
    pr = pull_request(source['number'])
    if pr.get('merged'):
        print('Merged PR: do not upload another checkpoint.')
        return
    source_database = state_database(root)
    session_id, _ = inspect_database(source_database, baseline.get('session_id'))
    checkpoint = root / 'checkpoint'
    checkpoint.mkdir()
    target = checkpoint / 'sessions.db'
    # SQLite's backup API produces one consistent file, even if a WAL exists.
    # The Goose process has exited before this function is invoked.
    with closing(connect_readonly(source_database)) as connection, closing(sqlite3.connect(target)) as destination:
        connection.backup(destination)
        # backup() inherits the source's WAL journal mode. Seal a standalone
        # database before validating/hashing it, and close every connection.
        destination.execute('PRAGMA journal_mode=DELETE')
    inspect_database(target, session_id)
    current = workflow_run()
    manifest = {
        **compatibility(), 'repository': repository(), 'number': source['number'],
        'recipe_sha256': digest(Path(__file__).with_name('recipe.yaml').read_bytes()),
        'session_id': session_id, 'head_sha': source['head_sha'],
        'base_sha': source['base_sha'], 'merge_base_sha': source['merge_base_sha'],
        'input_fingerprint': source['input_fingerprint'],
        'run_id': os.environ['GITHUB_RUN_ID'], 'run_attempt': os.environ['GITHUB_RUN_ATTEMPT'],
        'workflow_id': current['workflow_id'], 'predecessor_artifact_id': baseline.get('artifact_id'),
        'database_sha256': digest(target.read_bytes()),
    }
    write_json(checkpoint / 'manifest.json', manifest)
    write_json(checkpoint / 'result.json', result)
    shutil.copyfile(root / 'discussion.json', checkpoint / 'discussion.json')
    if {item.name for item in checkpoint.iterdir()} != PAYLOAD_FILES:
        raise ReviewError('unexpected_checkpoint_files')
    for name in PAYLOAD_FILES - {'sessions.db'}:
        maximum = 8_000_000 if name == 'discussion.json' else 1_000_000
        if (checkpoint / name).stat().st_size > maximum:
            raise ReviewError('checkpoint_payload_too_large')
    output('should_save', True)
    print('Prepared a consistent full-session checkpoint.')


def cleanup(root):
    number = pr_number(os.environ['PR_NUMBER'])
    if not pull_request(number).get('merged'):
        print('PR was not merged: keep its session until normal artifact expiry.')
        return
    current = workflow_run()
    cache = {}
    prefixes = tuple(artifact_prefix(kind, number) for kind in ('session', 'result', 'diagnostics'))
    # Enumerate all pages before deleting: deletion must not shift pagination.
    candidates = [item for item in pages(f'repos/{repository()}/actions/artifacts', 'artifacts')
                  if item.get('name', '').startswith(prefixes)]
    removed = 0
    for artifact in candidates:
        if trusted_artifact(artifact, current['workflow_id'], cache):
            # A concurrent/manual deletion is harmless, but other API failures fail
            # visibly. Workflow-level serialization prevents new PR uploads here.
            existing = api(f'repos/{repository()}/actions/artifacts/{artifact["id"]}',
                           binary=True, allow_missing=True)
            if existing:
                api(f'repos/{repository()}/actions/artifacts/{artifact["id"]}',
                    method='DELETE', binary=True, allow_missing=True)
                removed += 1
    remaining = [item for item in pages(f'repos/{repository()}/actions/artifacts', 'artifacts')
                 if item.get('name', '').startswith(prefixes)
                 and trusted_artifact(item, current['workflow_id'], cache)]
    if remaining:
        raise ReviewError('merge_cleanup_incomplete')
    print(f'Removed {removed} AI review artifacts for merged PR #{number}.')


if __name__ == '__main__':
    try:
        {'restore': restore, 'snapshot': snapshot, 'cleanup': cleanup}[sys.argv[1]](directory())
    except Exception as error:
        fail(error)
        sys.exit(1)
