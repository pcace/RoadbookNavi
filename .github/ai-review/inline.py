# SPDX-License-Identifier: GPL-3.0-only
"""Small host-side contract for inline findings and their review-thread history."""
import re
from common import ReviewError, fingerprint

PREFIX = '<!-- roadbooknavi-ai-finding:'
STATUS = '<!-- roadbooknavi-ai-status:'
STATES = {'open', 'fixed', 'retracted', 'unknown'}


def own_finding(comment):
    author = comment.get('author') or {}
    return (author.get('__typename') == 'Bot'
            and author.get('login') in {'github-actions', 'github-actions[bot]'}
            and (comment.get('body') or '').startswith(PREFIX))


def finding_targets(discussion):
    result = []
    for thread in discussion.get('threads', []):
        comments = thread['comments']['nodes']
        if not comments or not own_finding(comments[0]):
            continue
        first = comments[0]
        status = 'open'
        for comment in comments[1:]:
            author = comment.get('author') or {}
            if author.get('__typename') != 'Bot' or author.get('login') not in {'github-actions', 'github-actions[bot]'}:
                continue
            match = re.match(re.escape(STATUS) + r'(open|fixed|retracted|unknown) -->', comment.get('body') or '')
            if match:
                status = match[1]
        result.append({'comment_id': first['id'], 'url': first['url'], 'body': first['body'],
                       'path': thread['path'], 'line': thread.get('line'), 'status': status,
                       'resolved': thread.get('isResolved', False)})
    return result


def diff_lines(diff):
    """Git's zero-context patch gives unambiguous new-side ranges, including renames."""
    result = {}
    path = None
    for line in diff.splitlines():
        if line.startswith('--- a/'):
            result.setdefault(line[6:], set())
        if line.startswith('+++ b/'):
            path = line[6:]
        elif line == '+++ /dev/null':
            path = None
        elif path and (match := re.match(r'@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', line)):
            start, count = int(match[1]), int(match[2] or '1')
            result.setdefault(path, set()).update(range(start, start + count))
    return result


def validate(findings, updates, targets, diff):
    if not isinstance(findings, list) or len(findings) > 8 or not isinstance(updates, list):
        raise ReviewError('inline_findings_invalid')
    allowed = diff_lines(diff)
    locations = set()
    for item in findings:
        if (not isinstance(item, dict) or set(item) != {'path', 'line', 'priority', 'body'}
                or not isinstance(item['path'], str) or item['path'] not in allowed
                or type(item['line']) is not int or item['line'] < 1
                or item['priority'] not in {'P1', 'P2'} or not isinstance(item['body'], str)
                or not 20 <= len(item['body'].strip()) <= 6000):
            raise ReviewError('inline_findings_invalid')
        item['inline'] = item['line'] in allowed[item['path']]
        location = (item['path'], item['line'])
        if location in locations:
            raise ReviewError('duplicate_inline_finding')
        locations.add(location)
    expected = {item['comment_id'] for item in targets}
    seen = set()
    for item in updates:
        if (not isinstance(item, dict) or set(item) != {'comment_id', 'status', 'response'}
                or not isinstance(item['comment_id'], str) or item['comment_id'] not in expected
                or item['comment_id'] in seen or item['status'] not in STATES
                or not isinstance(item['response'], str) or not 20 <= len(item['response'].strip()) <= 6000):
            raise ReviewError('finding_update_invalid')
        seen.add(item['comment_id'])
    if seen != expected:
        raise ReviewError('finding_update_missing')
    return findings, updates


def reply_id(url):
    match = re.search(r'#discussion_r([1-9][0-9]*)$', url)
    if not match:
        raise ReviewError('invalid_thread_reply_target')
    return int(match[1])


def new_comments(findings, discussion, head):
    existing = [item for thread in discussion.get('threads', []) for item in thread['comments']['nodes']]
    comments = []
    for item in findings:
        key = fingerprint({'head': head, 'path': item['path'], 'line': item['line']})
        marker = PREFIX + key + ' -->'
        if any((old.get('body') or '').startswith(marker) for old in existing):
            continue
        # A still-open thread at the same current location should be updated,
        # rather than recreated with slightly different wording after a push.
        if any(old['status'] == 'open' and old['path'] == item['path'] and old['line'] == item['line']
               for old in finding_targets(discussion)):
            continue
        if item.get('inline', True):
            comments.append({'path': item['path'], 'line': item['line'], 'side': 'RIGHT',
                             'body': (marker + '\n\n**[' + item['priority'] + ']** ' + item['body']).replace('@', '@\u200b')})
    return comments


def progress(updates, targets, new_count):
    if not targets:
        return ''
    names = {'fixed': 'Fixed', 'open': 'Still open', 'retracted': 'Withdrawn', 'unknown': 'Not verified'}
    rows = ['### Since the last review']
    for state, label in names.items():
        items = [item for item in updates if item['status'] == state]
        if items:
            indexed = {item['comment_id']: item for item in targets}
            rows.append(f'- **{label}:** ' + '; '.join(
                f'[Finding]({indexed[item["comment_id"]]["url"]}) — {item["response"]}' for item in items))
    rows.append(f'- **New findings:** {new_count}.' if new_count else '- **New findings:** none.')
    return '\n'.join(rows)
