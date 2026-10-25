const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { capture, prepare, guard, completed, marker } = require('./review.cjs');

function fixture() {
  const repo = { owner: 'owner', repo: 'project' };
  const pr = {
    number: 7,
    state: 'open',
    draft: false,
    title: 'Fix routes',
    body: '',
    head: { sha: 'a'.repeat(40), repo: { full_name: 'owner/project' } },
    base: { sha: 'b'.repeat(40), ref: 'dev' },
  };
  const lists = { comments: [], reviews: [], inline: [] };
  const outputs = {};
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: pr }),
        listReviews: 'reviews',
        listReviewComments: 'inline',
      },
      issues: { listComments: 'comments' },
      repos: {
        getCollaboratorPermissionLevel: async () => ({
          data: { permission: 'write' },
        }),
      },
    },
    paginate: async method => lists[method],
  };
  const context = {
    repo,
    eventName: 'pull_request',
    ref: 'refs/heads/dev',
    payload: {
      repository: { default_branch: 'dev' },
      sender: { type: 'User', login: 'author' },
      pull_request: pr,
    },
  };
  const core = {
    setOutput: (key, value) => (outputs[key] = value),
    notice: () => {},
  };
  return {
    github,
    context,
    core,
    pr,
    lists,
    outputs,
    snapshot: () => capture(github, repo, 7),
  };
}
const human = (body, id = 1) => ({
  id,
  node_id: `PRRC_fixture_${id}`,
  body,
  user: { type: 'User', login: 'author' },
});
const bot = (body, id = 2) => ({
  id,
  node_id: `PRRC_fixture_${id}`,
  body,
  user: { type: 'Bot', login: 'github-actions[bot]' },
});
const summary = () => ({
  type: 'submit_pull_request_review',
  event: 'COMMENT',
  body: 'No new verified findings.',
});
const batch = (...replies) => ({
  type: 'reply_to_review_threads',
  replies: JSON.stringify(replies),
});
async function publish(f, items = [summary()], errors = []) {
  const dir = mkdtempSync(join(tmpdir(), 'review-test-'));
  const file = join(dir, 'output.json');
  writeFileSync(file, JSON.stringify({ items, errors }));
  try {
    await guard(f, f.outputs, file);
    return JSON.parse(readFileSync(file)).items;
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('authorized open PR captures immutable commits and publishes a review', async () => {
  const f = fixture();
  await prepare(f);
  assert.equal(f.outputs.ready, 'true');
  assert.equal(f.outputs.head, f.pr.head.sha);
  assert.deepEqual(await publish(f), [summary()]);
});
for (const [name, change] of [
  ['draft', f => (f.pr.draft = true)],
  ['closed', f => (f.pr.state = 'closed')],
  ['wrong base', f => (f.pr.base.ref = 'main')],
  ['fork', f => (f.pr.head.repo.full_name = 'external/project')],
  ['bot', f => (f.context.payload.sender.type = 'Bot')],
  [
    'read-only actor',
    f =>
      (f.github.rest.repos.getCollaboratorPermissionLevel = async () => ({
        data: { permission: 'read' },
      })),
  ],
  [
    'dispatch on feature branch',
    f => {
      f.context.eventName = 'workflow_dispatch';
      f.context.ref = 'refs/heads/feature';
    },
  ],
])
  test(`does not spend inference on ${name}`, async () => {
    const f = fixture();
    change(f);
    await prepare(f);
    assert.equal(f.outputs.ready, undefined);
  });
for (const [name, change] of [
  ['new head', f => (f.pr.head.sha = 'c'.repeat(40))],
  ['new base', f => (f.pr.base.sha = 'd'.repeat(40))],
  ['edited description', f => (f.pr.body = 'Different intent')],
  [
    'new discussion',
    f => f.lists.comments.push(human('Please check the other caller')),
  ],
  ['closed PR', f => (f.pr.state = 'closed')],
  ['draft PR', f => (f.pr.draft = true)],
])
  test(`suppresses an obsolete result after ${name}`, async () => {
    const f = fixture();
    await prepare(f);
    change(f);
    assert.deepEqual(await publish(f), []);
  });
test('edited and deleted human comments invalidate a snapshot; bot progress does not', async () => {
  const f = fixture();
  f.lists.comments.push(human('Initial question'));
  await prepare(f);
  f.lists.comments.push(bot('Progress'));
  assert.deepEqual(await publish(f), [summary()]);
  f.lists.comments[0].body = 'Corrected question';
  assert.deepEqual(await publish(f), []);
  await prepare(f);
  f.lists.comments.shift();
  assert.deepEqual(await publish(f), []);
});
test('successful state is deduplicated on preparation and publication, but human spoofing is ignored', async () => {
  const f = fixture();
  await prepare(f);
  f.lists.reviews.push({
    ...bot(marker(f.outputs.fingerprint)),
    state: 'COMMENTED',
  });
  assert.deepEqual(await publish(f), []);
  delete f.outputs.ready;
  await prepare(f);
  assert.equal(f.outputs.ready, undefined);
  f.lists.reviews[0].user = human('').user;
  assert.equal(completed(await f.snapshot()), false);
});
test('replies are scoped to this PR and retry-safe after partial publication', async () => {
  const f = fixture();
  f.lists.inline.push(human('Finding', 10), {
    ...human('Question', 11),
    in_reply_to_id: 10,
  });
  await prepare(f);
  const reply = {
    comment_id: 'PRRC_fixture_11',
    body: 'Evidence',
  };
  assert.equal(
    JSON.parse((await publish(f, [batch(reply), summary()]))[0].replies)[0]
      .comment_id,
    '10'
  );
  f.lists.inline.push({
    ...bot(marker(f.outputs.fingerprint), 12),
    in_reply_to_id: 10,
  });
  assert.deepEqual(await publish(f, [batch(reply), summary()]), [summary()]);
  await assert.rejects(
    publish(f, [batch({ ...reply, comment_id: 999 }), summary()]),
    /not a comment on this PR/
  );
});
test('an incomplete or approving answer cannot masquerade as a finished review', async () => {
  const f = fixture();
  await prepare(f);
  for (const items of [
    [],
    [summary(), summary()],
    [{ ...summary(), event: 'APPROVE' }],
  ]) {
    await assert.rejects(
      publish(f, items),
      /one completed, non-blocking review/
    );
  }
});
test('API failures fail closed', async () => {
  const f = fixture();
  f.github.rest.pulls.get = async () => {
    throw new Error('API unavailable');
  };
  await assert.rejects(prepare(f), /API unavailable/);
  assert.equal(f.outputs.ready, undefined);
});

test('thread reader admits only approved authors and the reviewer bot', async () => {
  const { reviewThreads } = require('./review.cjs');
  const items = [
    { ...human('Owner', 1), author_association: 'OWNER' },
    { ...human('Member', 2), author_association: 'MEMBER' },
    { ...human('Collaborator', 3), author_association: 'COLLABORATOR' },
    bot('Earlier finding', 4),
    { ...human('External', 5), author_association: 'NONE' },
    { ...human('Contribution', 6), author_association: 'CONTRIBUTOR' },
    { id: 7, body: 'Claimed OWNER without API metadata' },
  ];
  const result = await reviewThreads(
    { repository: 'owner/project', number: 7, token: 'test-token' },
    async (url, options) => {
      assert.equal(
        url,
        'https://api.github.com/repos/owner/project/pulls/7/comments?per_page=100&page=1'
      );
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return { ok: true, json: async () => items };
    }
  );
  assert.deepEqual(
    result.comments.map(c => c.id),
    ['PRRC_fixture_1', 'PRRC_fixture_2', 'PRRC_fixture_3', 'PRRC_fixture_4']
  );
  assert.equal(result.filtered, 3);
  assert.ok(!JSON.stringify(result).includes('test-token'));
});

test('blocked authors take precedence over owner and bot trust', async () => {
  const { reviewThreads } = require('./review.cjs');
  const result = await reviewThreads(
    {
      repository: 'owner/project',
      number: 7,
      token: '',
      blockedUsers: ' AUTHOR,\nGITHUB-ACTIONS[BOT] ',
    },
    async () => ({
      ok: true,
      json: async () => [
        { ...human('Owner'), author_association: 'OWNER' },
        bot('Finding'),
      ],
    })
  );
  assert.deepEqual(result, { comments: [], filtered: 2 });
});

test('thread reader paginates even when the first page is entirely filtered', async () => {
  const { reviewThreads } = require('./review.cjs');
  const seen = [];
  const reply = {
    ...bot('Reply', 101),
    in_reply_to_id: 10,
    html_url: 'https://github.com/owner/project/pull/7#discussion_r101',
  };
  const result = await reviewThreads(
    { repository: 'owner/project', number: 7, token: '' },
    async url => {
      seen.push(url);
      return {
        ok: true,
        json: async () =>
          seen.length === 1
            ? Array.from({ length: 100 }, (_, id) => human('External', id))
            : [reply],
      };
    }
  );
  assert.equal(seen.length, 2);
  assert.ok(seen[1].endsWith('page=2'));
  assert.equal(result.filtered, 100);
  assert.equal(result.comments[0].in_reply_to_id, 'PRRC_fixture_10');
  assert.equal(result.comments[0].html_url, reply.html_url);
});

test('thread read failures never masquerade as an empty discussion', async () => {
  const { reviewThreads } = require('./review.cjs');
  await assert.rejects(
    reviewThreads(
      { repository: 'owner/project', number: 7, token: '' },
      async () => ({ ok: false, status: 403 })
    ),
    /HTTP 403/
  );
});

test('node IDs avoid numeric tool arguments without changing comment content', async () => {
  const { reviewThreads } = require('./review.cjs');
  const node = 'PRRC_kwDOUwIRns8AAAABBIPx4A';
  const body = 'Contact fixture: alex@example.com or 2025550147.';
  const result = await reviewThreads(
    { repository: 'owner/project', number: 7, token: '' },
    async () => ({
      ok: true,
      json: async () => [
        {
          ...bot(body, 4370723296),
          node_id: node,
        },
      ],
    })
  );
  assert.equal(result.comments[0].id, node);
  assert.equal(result.comments[0].body, body);
  assert.ok(!JSON.stringify(result).includes('4370723296'));
  const f = fixture();
  f.lists.inline.push({ ...bot(body, 4370723296), node_id: node });
  await prepare(f);
  const reply = {
    comment_id: node,
    body: 'Reply',
  };
  assert.equal(
    JSON.parse((await publish(f, [batch(reply), summary()]))[0].replies)[0]
      .comment_id,
    '4370723296'
  );
  for (const id of [4370723296, '4370723296', '[PHONE]', 'PRRC_other_pr'])
    await assert.rejects(
      publish(f, [batch({ ...reply, comment_id: id }), summary()]),
      /not a comment on this PR/
    );
});

test('node-ID adapter retains the twenty-reply limit', async () => {
  const f = fixture();
  f.lists.inline.push(human('Finding', 10));
  await prepare(f);
  const replies = Array.from({ length: 21 }, () => ({
    comment_id: 'PRRC_fixture_10',
    body: 'Reply',
  }));
  await assert.rejects(
    publish(f, [batch(...replies), summary()]),
    /at most 20/
  );
});

test('missing node metadata fails instead of falling back to a numeric ID', async () => {
  const { reviewThreads } = require('./review.cjs');
  await assert.rejects(
    reviewThreads(
      { repository: 'owner/project', number: 7, token: '' },
      async () => ({
        ok: true,
        json: async () => [{ ...bot('Finding'), node_id: null }],
      })
    ),
    /missing its GitHub node ID/
  );
});

test('one reply batch retains both threads and retries only unpublished replies', async () => {
  const f = fixture();
  f.lists.inline.push(human('First', 10), human('Second', 20));
  await prepare(f);
  const replies = batch(
    { comment_id: 'PRRC_fixture_10', body: 'First answer' },
    { comment_id: 'PRRC_fixture_20', body: 'Second answer' }
  );
  const first = await publish(f, [replies, summary()]);
  assert.deepEqual(
    JSON.parse(first[0].replies).map(r => r.comment_id),
    ['10', '20']
  );
  f.lists.inline.push({
    ...bot(marker(f.outputs.fingerprint), 30),
    in_reply_to_id: 10,
  });
  const retry = await publish(f, [replies, summary()]);
  assert.deepEqual(JSON.parse(retry[0].replies), [
    { comment_id: '20', body: 'Second answer' },
  ]);
});

test('discarded or malformed outputs cannot publish a completion marker', async () => {
  const f = fixture();
  f.lists.inline.push(human('First', 10));
  await prepare(f);
  await assert.rejects(
    publish(f, [summary()], ['Too many items']),
    /Incomplete agent output/
  );
  for (const replies of ['{', '{}', '[null]'])
    await assert.rejects(
      publish(f, [{ type: 'reply_to_review_threads', replies }, summary()])
    );
  await assert.rejects(
    publish(f, [batch({ comment_id: 'PRRC_fixture_10', body: '' }), summary()]),
    /non-empty text/
  );
});
