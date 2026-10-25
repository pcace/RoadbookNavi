---
name: Review engine smoke test
on:
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: read
engine:
  id: pi
  model: openai/gpt-5.3-codex
  model-provider: openai
  bare: true
  env:
    OPENAI_BASE_URL: https://openrouter.ai/api/v1
    CODEX_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
network:
  allowed: [defaults, openrouter.ai]
tools:
  edit: false
  bash: ["git status", "git ls-files", "git show", "cat", "grep", "find", "sed", "head"]
  github:
    toolsets: [pull_requests]
    read-only: true
safe-outputs:
  staged: true
  add-comment:
    target: "37"
    max: 1
  threat-detection: false # Staged smoke test cannot publish anything.
timeout-minutes: 15
max-turns: 12
max-tool-calls: 30
---
Read ARCHITECTURE.md, then independently find and read one TypeScript routing
implementation and one of its callers. Use the repository tools, not guesses.
Use add_comment to report their exact paths, how they relate, and one concrete
boundary contract in at most 100 words. This is a staged smoke test; do not
claim to have reviewed a pull request. Do not execute repository code.
