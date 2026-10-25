---
name: AI PR Review
description: Investigate PRs with Pi; publish concise, evidence-based reviews.
on:
  issue_comment:
    types: [created, edited]
  pull_request:
    types: [opened, reopened, ready_for_review, synchronize, edited]
  pull_request_review_comment:
    types: [created, edited]
  pull_request_review:
    types: [submitted, edited]
  workflow_dispatch:
    inputs:
      pr_number:
        description: Open PR targeting the default branch
        type: string
        required: true
  roles: [admin, maintainer, write]
  needs: [context]
  reaction: none
if: needs.context.outputs.ready == 'true'
permissions:
  contents: read
  pull-requests: read
concurrency:
  group: ai-review-${{ github.repository_id }}-${{ github.event.pull_request.number || github.event.issue.number || inputs.pr_number || github.run_id }}
  cancel-in-progress: false
  queue: max
  job-discriminator: ${{ github.run_id }}
engine:
  id: pi
  model: openrouter/${{ vars.AI_REVIEW_MODEL }}
  model-provider: openai
  bare: true
  env:
    OPENAI_BASE_URL: https://openrouter.ai/api/v1
    OPENAI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    CODEX_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  config: |
    {"settings":{"defaultTools":["read","grep","find","ls"],"defaultThinkingLevel":"high"}}
network:
  allowed: [defaults, openrouter.ai]
tools:
  bash: false
  edit: false
  cli-proxy: false
  github:
    toolsets: [pull_requests]
    read-only: true
checkout:
  ref: ${{ needs.context.outputs.head }}
  fetch-depth: 0
steps:
  - name: Install Pi search tools
    run: |
      sudo apt-get update -qq
      sudo apt-get install -y fd-find ripgrep
      mkdir -p /tmp/gh-aw/pi-agent-dir/bin
      cp /usr/bin/fdfind /tmp/gh-aw/pi-agent-dir/bin/fd
      cp /usr/bin/rg /tmp/gh-aw/pi-agent-dir/bin/rg
pre-agent-steps:
  - name: Prepare complete diff of the captured commits
    env:
      REVIEW_HEAD: ${{ needs.context.outputs.head }}
      REVIEW_BASE: ${{ needs.context.outputs.base }}
    run: git diff --no-ext-diff --no-textconv "$REVIEW_BASE...$REVIEW_HEAD" > /tmp/gh-aw/pr.diff
imports:
  - ../ai-review/instructions.md
safe-outputs:
  needs: [context]
  create-pull-request-review-comment:
    target: ${{ needs.context.outputs.number }}
    commit-id: ${{ needs.context.outputs.head }}
    max: 6
  reply-to-pull-request-review-comment:
    target: ${{ needs.context.outputs.number }}
    max: 20
  submit-pull-request-review:
    target: ${{ needs.context.outputs.number }}
    commit-id: ${{ needs.context.outputs.head }}
    allowed-events: [COMMENT]
    max: 1
  report-failure-as-issue: false
  threat-detection:
    engine:
      id: codex
      model: ${{ vars.AI_REVIEW_MODEL }}
      env:
        OPENAI_BASE_URL: https://openrouter.ai/api/v1
        OPENAI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        CODEX_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    max-ai-credits: 50
    continue-on-error: false
    report-as-issue: false
  messages:
    footer: "[AI review]({run_url}) · Commit ${{ needs.context.outputs.head }}\n\n<!-- ai-review-state:${{ needs.context.outputs.fingerprint }} -->"
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      with:
        ref: ${{ github.event.pull_request.base.sha || github.workflow_sha }}
        path: review-automation
        sparse-checkout: .github/ai-review
        persist-credentials: false
    - name: Reject stale results and repeated publication
      uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3
      env:
        GH_AW_AGENT_OUTPUT: ${{ steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT }}
        REVIEW_NUMBER: ${{ needs.context.outputs.number }}
        REVIEW_FINGERPRINT: ${{ needs.context.outputs.fingerprint }}
      with:
        script: |
          await require('./review-automation/.github/ai-review/review.cjs').guard(
            {github, context, core},
            {number: process.env.REVIEW_NUMBER, fingerprint: process.env.REVIEW_FINGERPRINT}
          );
jobs:
  context:
    if: >-
      github.event.sender.type != 'Bot' &&
      (github.event_name != 'issue_comment' || github.event.issue.pull_request)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      ready: ${{ steps.context.outputs.ready }}
      number: ${{ steps.context.outputs.number }}
      head: ${{ steps.context.outputs.head }}
      base: ${{ steps.context.outputs.base }}
      fingerprint: ${{ steps.context.outputs.fingerprint }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: ${{ github.event.pull_request.base.sha || github.workflow_sha }}
          sparse-checkout: .github/ai-review
          persist-credentials: false
      - uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3
        id: context
        if: hashFiles('.github/ai-review/review.cjs') != ''
        with:
          script: await require('./.github/ai-review/review.cjs').prepare({github, context, core});
max-ai-credits: 200
max-daily-ai-credits: 2000
timeout-minutes: 20
max-turns: 50
max-tool-calls: 150
---

Review PR **#${{ needs.context.outputs.number }}** in **${{ github.repository }}**.
The checkout is commit `${{ needs.context.outputs.head }}`; its base is
`${{ needs.context.outputs.base }}`. Investigate this snapshot, not a moving branch.
