# SPDX-License-Identifier: GPL-3.0-only
"""Inline publication, thread replies and finding lifecycle without model calls."""
import unittest
from unittest.mock import patch
import common
import inline
import review
import test_followups

PATCH = '--- a/src/route.ts\n+++ b/src/route.ts\n@@ -3 +3,2 @@\n-old\n+new\n+guard\n'


def finding():
    return {'path': 'src/route.ts', 'line': 3, 'priority': 'P2',
            'body': 'A cancelled request can overwrite the new route. Check its identity before saving.'}


def thread(status=None):
    author = {'__typename': 'Bot', 'login': 'github-actions'}
    comments = [{'id': 'PRRC_root', 'url': 'https://github.com/pcace/RoadbookNavi/pull/7#discussion_r42',
                 'author': author, 'body': inline.PREFIX + 'a' * 64 + ' -->\nOriginal finding'}]
    if status:
        comments.append({'id': 'PRRC_status', 'url': 'https://github.com/pcace/RoadbookNavi/pull/7#discussion_r43',
                         'author': author, 'body': inline.STATUS + status + ' -->\nRechecked.'})
    return {'id': 'thread', 'path': 'src/route.ts', 'line': 3, 'isResolved': False,
            'comments': {'nodes': comments}}


class InlineTests(unittest.TestCase):
    setUp = test_followups.FollowupTests.setUp
    tearDown = test_followups.FollowupTests.tearDown
    command = test_followups.FollowupTests.command
    publication = test_followups.FollowupTests.publication
    publish_with = test_followups.FollowupTests.publish_with
    def test_inline_positions_fallback_and_invalid_path(self):
        data, _ = inline.validate([finding()], [], [], PATCH)
        self.assertTrue(data[0]['inline'])
        data, _ = inline.validate([finding() | {'line': 50}], [], [], PATCH)
        self.assertFalse(data[0]['inline'])
        with self.assertRaises(common.ReviewError):
            inline.validate([finding() | {'path': '../other'}], [], [], PATCH)
        self.assertEqual(inline.diff_lines('--- a/removed\n+++ /dev/null\n@@ -1 +0,0 @@\n-gone\n'), {'removed': set()})

    def test_status_requires_exact_known_findings(self):
        targets = inline.finding_targets({'threads': [thread()]})
        update = {'comment_id': 'PRRC_root', 'status': 'fixed', 'response': 'The added request identity check prevents stale writes.'}
        self.assertEqual(inline.validate([], [update], targets, PATCH)[1], [update])
        for updates in ([], [update, update], [update | {'comment_id': 'invented'}]):
            with self.assertRaises(common.ReviewError):
                inline.validate([], updates, targets, PATCH)
        fake = thread();fake['comments']['nodes'][0]['author'] = {'__typename': 'User', 'login': 'alice'}
        self.assertEqual(inline.finding_targets({'threads': [fake]}), [])

    def test_reassessment_preserves_status_and_does_not_duplicate_open_threads(self):
        discussion = {'threads': [thread('fixed')]}
        self.assertEqual(inline.finding_targets(discussion)[0]['status'], 'fixed')
        self.assertEqual(inline.new_comments([finding()], {'threads': [thread()]}, 'a' * 40), [])
        targets = inline.finding_targets(discussion)
        text = inline.progress([{'comment_id': 'PRRC_root', 'status': 'unknown',
                                 'response': 'Cannot verify the affected platform from current code.'}], targets, 0)
        self.assertIn('Not verified', text)
        self.assertIn('New findings:** none', text)
        self.assertNotIn('**Fixed:', text)

    def test_initial_findings_publish_as_one_comment_review_and_retry_is_idempotent(self):
        result = self.publication();result.update(responses=[], findings=[finding()])
        common.write_json(self.root / 'result.json', result)
        calls = self.publish_with({}, [])
        self.assertEqual(calls[0].args[0], 'repos/pcace/RoadbookNavi/pulls/7/reviews')
        payload = calls[0].kwargs['payload']
        self.assertEqual(len(calls), 1)  # Summary is the actual review body.
        self.assertIn('1 new finding', payload['body'])
        self.assertIn('### Checked and limits', payload['body'])
        self.assertNotIn('discussion and status are in the PR summary', payload['body'])
        self.assertEqual(payload['event'], 'COMMENT')
        self.assertEqual(payload['commit_id'], 'a' * 40)
        self.assertEqual(payload['comments'][0]['side'], 'RIGHT')
        posted = thread();posted['comments']['nodes'][0]['body'] = payload['comments'][0]['body']
        self.assertFalse(any(call.args[0].endswith('/reviews') for call in self.publish_with({'threads': [posted]}, [])))

    def test_fix_push_posts_status_in_thread_and_visible_progress(self):
        result = self.publication()
        discussion = {'threads': [thread()]}
        result.update(responses=[], push_update_key='c' * 64, findings=[],
                      finding_targets=inline.finding_targets(discussion),
                      finding_updates=[{'comment_id': 'PRRC_root', 'status': 'fixed',
                                        'response': 'The new identity check prevents stale requests overwriting the route.'}])
        common.write_json(self.root / 'result.json', result)
        calls = self.publish_with(discussion, [])
        self.assertTrue(calls[1].args[0].endswith('/comments/42/replies'))
        self.assertIn(inline.STATUS + 'fixed', calls[1].kwargs['payload']['body'])
        self.assertIn('**Fixed:**', calls[0].kwargs['payload']['body'])
        self.assertIn('New findings:** none', calls[0].kwargs['payload']['body'])
        self.assertFalse(any(call.args[0].endswith('/comments/42/replies')
                             for call in self.publish_with({'threads': [thread('fixed')]}, [])))

    def test_human_thread_reply_answers_root_and_is_not_answered_twice(self):
        source = thread()
        human = self.command('Why is the existing guard insufficient?', 'PRRC_human')
        human['url'] = 'https://github.com/pcace/RoadbookNavi/pull/7#discussion_r44'
        source['comments']['nodes'].append(human)
        discussion = {'threads': [source]}
        target = review.reply_targets(discussion)[0]
        self.assertEqual(target['reply_to'], 42)
        result = self.publication();result['responses'] = [target | {'response': 'The guard checks the original route, rather than the active request.'}]
        common.write_json(self.root / 'result.json', result)
        calls = self.publish_with(discussion, [])
        self.assertTrue(calls[-1].args[0].endswith('/comments/42/replies'))
        self.assertNotIn('AI review response', calls[-1].kwargs['payload']['body'])
        self.assertNotIn('In response to your comment', calls[-1].kwargs['payload']['body'])
        source['comments']['nodes'].append({'id': 'PRRC_answer', 'author': source['comments']['nodes'][0]['author'],
                                            'body': calls[-1].kwargs['payload']['body']})
        discussion['previous_ai_responses'] = [source['comments']['nodes'][-1]]
        self.assertEqual(review.reply_targets(discussion), [])

    def test_push_with_new_findings_posts_one_review_and_retry_posts_nothing(self):
        result = self.publication()
        result.update(responses=[], findings=[finding()], push_update_key='c' * 64)
        common.write_json(self.root / 'result.json', result)
        calls = self.publish_with({}, [])
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].args[0].endswith('/reviews'))
        body = calls[0].kwargs['payload']['body']
        posted = thread()
        posted['comments']['nodes'][0]['body'] = calls[0].kwargs['payload']['comments'][0]['body']
        discussion = {'threads': [posted], 'previous_ai_reports': [{'body': body}]}
        self.assertEqual(self.publish_with(discussion, []), [])

    def test_unchanged_fixed_findings_do_not_repeat_after_documentation_push(self):
        discussion = {'threads': [thread('fixed')]}
        targets = inline.finding_targets(discussion)
        updates = [{'comment_id': 'PRRC_root', 'status': 'fixed',
                    'response': 'Long explanation that was already posted in the thread.'}]
        text = inline.progress(updates, targets, 0)
        self.assertIn('Still open:** none', text)
        self.assertIn('New findings:** none', text)
        self.assertNotIn('**Fixed:**', text)
        self.assertNotIn('Long explanation', text)
        self.assertNotIn('discussion_r42', text)

    def test_progress_links_open_findings_without_repeating_thread_explanations(self):
        targets = inline.finding_targets({'threads': [thread()]})
        updates = [{'comment_id': 'PRRC_root', 'status': 'open',
                    'response': 'Long explanation that belongs only in the thread.'}]
        text = inline.progress(updates, targets, 0)
        self.assertIn('src/route.ts:3', text)
        self.assertIn('discussion_r42', text)
        self.assertNotIn('Long explanation', text)

    def test_outdated_finding_links_do_not_show_missing_line_numbers(self):
        source = thread()
        source['line'] = None
        targets = inline.finding_targets({'threads': [source]})
        for status in ('open', 'fixed'):
            with self.subTest(status=status):
                text = inline.progress([{'comment_id': 'PRRC_root', 'status': status,
                                         'response': 'Current status verified against the changed implementation.'}], targets, 0)
                self.assertIn('[src/route.ts](https://github.com/', text)
                self.assertNotIn(':None', text)


if __name__ == '__main__':
    unittest.main()
