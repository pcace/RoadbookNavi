// Exercise the compiled adapter through the pinned framework, without GitHub writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const actions =
  process.env.GH_AW_ACTIONS_DIR ||
  path.join(process.env.RUNNER_TEMP, 'gh-aw/actions');
const source = fs.readFileSync(
  path.join(__dirname, '../workflows/ai-review.lock.yml'),
  'utf8'
);
const config = JSON.parse(
  JSON.parse(source.match(/GH_AW_SAFE_OUTPUTS_CONFIG: ("[^\n]+")/)[1])
);
const dir = fs.mkdtempSync(
  path.join(require('node:os').tmpdir(), 'review-framework-')
);
const calls = [];
global.core = {
  info() {},
  debug() {},
  warning() {},
  error() {},
  setOutput() {},
  exportVariable(name, value) {
    process.env[name] = value;
  },
  setFailed(message) {
    throw new Error(message);
  },
};
global.context = {
  repo: { owner: 'owner', repo: 'project' },
  runId: 1,
  eventName: 'workflow_dispatch',
  payload: { repository: { html_url: 'https://github.com/owner/project' } },
};
global.github = {
  rest: {
    pulls: {
      createReplyForReviewComment: async item => {
        calls.push(item);
        return {
          data: {
            id: calls.length,
            html_url: `https://github.com/owner/project/pull/7#discussion_r${calls.length}`,
          },
        };
      },
    },
  },
};
process.env.GH_AW_SAFE_OUTPUTS_CONFIG_PATH = path.join(dir, 'config.json');
process.env.GH_AW_SAFE_OUTPUTS = path.join(dir, 'outputs.jsonl');
process.env.GH_AW_SAFE_OUTPUT_MESSAGES = JSON.stringify({
  footer: 'Review {run_url}\n<!-- ai-review-state:test -->',
});
process.env.GH_AW_WORKFLOW_NAME = 'AI PR Review';
// Redirect only the test copy's output destination, before ingestion imports it.
require(path.join(actions, 'constants.cjs')).TMP_GH_AW_PATH = dir;
fs.writeFileSync(
  process.env.GH_AW_SAFE_OUTPUTS_CONFIG_PATH,
  JSON.stringify(config)
);
const replies = [
  { comment_id: 'PRRC_first', body: 'First `cache` answer.\nSecond line.' },
  { comment_id: 'PRRC_second', body: 'Second thread answer.' },
];
fs.writeFileSync(
  process.env.GH_AW_SAFE_OUTPUTS,
  JSON.stringify({
    type: 'reply_to_review_threads',
    replies: JSON.stringify(replies),
  })
);
(async () => {
  await require(path.join(actions, 'collect_ndjson_output.cjs')).main();
  const output = JSON.parse(
    fs.readFileSync(path.join(dir, 'agent_output.json'), 'utf8')
  );
  assert.deepEqual(output.errors, []);
  assert.equal(output.items.length, 1);
  assert.deepEqual(JSON.parse(output.items[0].replies), replies);
  // review.test.cjs checks node-to-REST mapping and PR scope; publisher receives its result.
  output.items[0].replies = JSON.stringify(
    replies.map((reply, index) => ({
      ...reply,
      comment_id: String(4370723296 + index),
    }))
  );
  const block = source.match(
    /          \/\/ @ts-check\n          \/\/\/ <reference types="\.\/safe-output-script"[\s\S]*?          module\.exports = \{ main \};/
  )[0];
  const script = block
    .split('\n')
    .map(line => line.slice(10))
    .join('\n')
    .replace('${{ needs.context.outputs.number }}', '7');
  const filename = path.join(actions, 'reviewer-contract-test.cjs');
  const adapter = new Module(filename, module);
  adapter.filename = filename;
  adapter.paths = Module._nodeModulePaths(actions);
  adapter._compile(script, filename);
  const publish = await adapter.exports.main();
  assert.equal((await publish(output.items[0], {})).success, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(call => call.comment_id),
    [4370723296, 4370723297]
  );
  for (const call of calls) {
    assert.equal(call.pull_number, 7);
    assert.equal(call.owner, 'owner');
    assert.equal(call.repo, 'project');
    assert.match(call.body, /ai-review-state:test/);
  }
  console.log(
    'PASS: two replies survive native ingestion and reach the native publisher with correct targets and footers.'
  );
})()
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
