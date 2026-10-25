---
name: Review engine smoke test
on:
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: read
engine:
  id: pi
  model: openrouter/${{ vars.AI_REVIEW_MODEL }}
  model-provider: openai
  bare: true
  config: |
    {"settings":{"defaultTools":["read","grep","find","ls"],"defaultThinkingLevel":"high"}}
  env:
    OPENAI_BASE_URL: https://openrouter.ai/api/v1
    CODEX_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
network:
  allowed: [defaults, openrouter.ai]
tools:
  edit: false
  bash: false
  cli-proxy: false
  github:
    toolsets: [pull_requests]
    read-only: true
steps:
  - name: Install Pi search tools
    run: |
      sudo apt-get update -qq
      sudo apt-get install -y fd-find ripgrep
      mkdir -p /tmp/gh-aw/pi-agent-dir/bin
      cp /usr/bin/fdfind /tmp/gh-aw/pi-agent-dir/bin/fd
      cp /usr/bin/rg /tmp/gh-aw/pi-agent-dir/bin/rg
safe-outputs:
  staged: true
  add-comment:
    target: "37"
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
timeout-minutes: 15
max-turns: 12
max-tool-calls: 30
---
Read ARCHITECTURE.md, then independently find and read one TypeScript routing
implementation and one of its callers. Use the repository tools, not guesses.
Use add_comment to report their exact paths, how they relate, and one concrete
boundary contract in at most 100 words. This is a staged smoke test; do not
claim to have reviewed a pull request. Do not execute repository code.

Exercise read, find and grep successfully before reporting the result.
