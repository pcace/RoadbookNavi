// Deterministic GitHub guards. Pi investigates; gh-aw owns all publishing.
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');

const marker = fingerprint => `<!-- ai-review-state:${fingerprint} -->`;
const isHuman = item => item.user?.type === 'User';
const isReviewer = item => item.user?.login === 'github-actions[bot]';

async function capture(github, repo, number) {
  const params = {
    ...repo,
    pull_number: number,
    issue_number: number,
    per_page: 100,
  };
  const [{ data: pr }, comments, reviews, inline] = await Promise.all([
    github.rest.pulls.get(params),
    github.paginate(github.rest.issues.listComments, params),
    github.paginate(github.rest.pulls.listReviews, params),
    github.paginate(github.rest.pulls.listReviewComments, params),
  ]);
  const discussion = [comments, reviews, inline].map(items =>
    items
      .filter(isHuman)
      .map(({ id, body, updated_at, submitted_at, state }) => ({
        id,
        body,
        updated_at,
        submitted_at,
        state,
      }))
      .sort((a, b) => a.id - b.id)
  );
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        head: pr.head.sha,
        base: pr.base.sha,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        draft: pr.draft,
        discussion,
      })
    )
    .digest('hex');
  return { pr, comments, reviews, inline, fingerprint };
}

function eligible(pr, repo, base) {
  return (
    pr.state === 'open' &&
    !pr.draft &&
    pr.base.ref === base &&
    pr.head.repo?.full_name === `${repo.owner}/${repo.repo}`
  );
}

function completed(state) {
  return state.reviews.some(
    review =>
      isReviewer(review) &&
      review.state === 'COMMENTED' &&
      review.body?.includes(marker(state.fingerprint))
  );
}

async function prepare({ github, context, core }) {
  const event = context.payload;
  const actor = event.sender;
  if (actor?.type !== 'User') return;
  const { data: access } =
    await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username: actor.login,
    });
  if (!['admin', 'maintain', 'write'].includes(access.permission)) return;
  const base =
    process.env.REVIEW_BASE_BRANCH || event.repository.default_branch;
  if (
    context.eventName === 'workflow_dispatch' &&
    context.ref !== `refs/heads/${base}`
  )
    return;
  let number =
    event.pull_request?.number ||
    (event.issue?.pull_request && event.issue.number) ||
    event.inputs?.pr_number;
  if (!/^[1-9]\d*$/.test(String(number))) return;
  const state = await capture(github, context.repo, Number(number));
  if (!eligible(state.pr, context.repo, base) || completed(state)) return;
  for (const [key, value] of Object.entries({
    number,
    head: state.pr.head.sha,
    base: state.pr.base.sha,
    fingerprint: state.fingerprint,
    ready: 'true',
  }))
    core.setOutput(key, String(value));
}

// Called immediately before gh-aw's built-in safe-output handlers. No GitHub writes here.
async function guard(
  { github, context, core },
  expected,
  file = process.env.GH_AW_AGENT_OUTPUT
) {
  const state = await capture(github, context.repo, Number(expected.number));
  const output = JSON.parse(readFileSync(file, 'utf8'));
  if (output.errors?.length)
    throw new Error('Incomplete agent output: ' + output.errors.join('; '));
  if (
    !eligible(
      state.pr,
      context.repo,
      process.env.REVIEW_BASE_BRANCH ||
        context.payload.repository.default_branch
    ) ||
    state.fingerprint !== expected.fingerprint ||
    completed(state)
  ) {
    core.notice(
      'PR changed or this state was already reviewed; suppressing stale/duplicate output.'
    );
    output.items = [];
  } else {
    const summaries = output.items.filter(
      item => item.type === 'submit_pull_request_review'
    );
    if (
      summaries.length !== 1 ||
      summaries[0].event !== 'COMMENT' ||
      !summaries[0].body?.trim()
    ) {
      throw new Error('Expected one completed, non-blocking review summary.');
    }
    output.items = output.items.filter(item => {
      if (item.type !== 'reply_to_review_threads') return true;
      const replies = JSON.parse(item.replies);
      if (!Array.isArray(replies) || replies.length > 20)
        throw new Error('Expected an array of at most 20 thread replies.');
      const pending = replies
        .map(({ comment_id, body }) => {
          const target = state.inline.find(
            comment => comment.node_id === comment_id
          );
          if (!target)
            throw new Error('Reply target is not a comment on this PR.');
          if (typeof body !== 'string' || !body.trim())
            throw new Error('Thread reply body must be non-empty text.');
          // Only the publisher sees the REST ID; the model uses GitHub node IDs.
          return {
            comment_id: String(target.in_reply_to_id || target.id),
            body,
          };
        })
        .filter(
          reply =>
            !state.inline.some(
              comment =>
                isReviewer(comment) &&
                comment.in_reply_to_id === Number(reply.comment_id) &&
                comment.body?.includes(marker(expected.fingerprint))
            )
        );
      item.replies = JSON.stringify(pending);
      return pending.length > 0;
    });
  }
  writeFileSync(file, JSON.stringify(output));
}

// The upstream MCP thread response drops author association, so its approved
// filter rejects the entire collection. Read REST metadata and enforce the same
// approved-author boundary here; unknown and blocked authors stay excluded.
async function reviewThreads(
  { repository, number, token, blockedUsers = '' },
  request = fetch
) {
  const blocked = new Set(blockedUsers.toLowerCase().split(/[,\s]+/));
  const comments = [];
  const nodes = new Map();
  let filtered = 0;
  for (let page = 1; ; page++) {
    const response = await request(
      `https://api.github.com/repos/${repository}/pulls/${number}/comments?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    if (!response.ok)
      throw new Error(`Review thread read failed: HTTP ${response.status}`);
    const batch = await response.json();
    for (const item of batch) {
      nodes.set(item.id, item.node_id);
      const login = item.user?.login || '';
      if (
        blocked.has(login.toLowerCase()) ||
        (!['OWNER', 'MEMBER', 'COLLABORATOR'].includes(
          item.author_association
        ) &&
          !isReviewer(item))
      ) {
        filtered++;
        continue;
      }
      if (typeof item.node_id !== 'string' || !item.node_id)
        throw new Error('Review comment is missing its GitHub node ID.');
      const { id, in_reply_to_id, body, path, line, original_line, html_url } =
        item;
      comments.push({
        id,
        in_reply_to_id,
        author: login,
        body,
        path,
        line,
        original_line,
        html_url,
      });
    }
    if (batch.length < 100)
      return {
        comments: comments.map(({ id, in_reply_to_id, ...comment }) => ({
          ...comment,
          id: nodes.get(id),
          in_reply_to_id: nodes.get(in_reply_to_id),
        })),
        filtered,
      };
  }
}

module.exports = {
  capture,
  eligible,
  completed,
  prepare,
  guard,
  marker,
  reviewThreads,
};
