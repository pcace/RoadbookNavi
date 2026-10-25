# AI PR reviewer

Pi investigates the complete PR checkout through OpenRouter. GitHub Agentic
Workflows publishes a non-blocking review with inline findings and thread replies.
It runs on PR updates and human discussion; `/review` or the manual workflow
requests another pass. Only repository writers and PRs targeting the default
branch are admitted. Drafts, forks and already-reviewed states are skipped.

## The files

- `../workflows/ai-review.md`: events, model, tools, limits and safe outputs.
- `instructions.md`: portable review behavior. Start here to tune review quality.
- `../review-context.md`: optional project-specific guidance.
- `review.cjs`: authorization, snapshots, publication guards and filtered thread reads.
- `review.test.cjs`: offline regression tests for those checks.
- `../workflows/ai-review.lock.yml`: generated; do not edit.

## Install in another repository

Copy this directory, `ai-review.md`, `ai-review-checks.yml`, and optionally adapt
`review-context.md`. Set secret `OPENROUTER_API_KEY` and variable `AI_REVIEW_MODEL`
(e.g. `openai/gpt-5.3-codex`). Install the pinned compiler and compile:

```sh
gh extension install github/gh-aw --pin v0.93.4
gh aw compile ai-review
node .github/ai-review/review.test.cjs
```

Commit the source, generated lock file, `.github/aw/actions-lock.json` and generated
`.gitattributes`; ignore `*.lock.yml` in Prettier. Recompile after configuration
changes. GitHub enables the workflow after merging into the default branch.

## Boundaries

Pi can read/search code and GitHub discussions, but cannot run shell commands,
execute project code or edit files. Its provider credential stays in the inference
proxy. GitHub writes use the built-in safe-output handlers in a separate job.
Review instructions and executable guards are loaded from the PR base revision;
workflow configuration changes need the same care as other CI changes.
GitHub reads are scoped to this repository. The approved-content filter also
allows `github-actions[bot]` so earlier reviews remain visible; unapproved external
authors can be filtered. A small REST reader handles inline threads because the
upstream MCP thread format loses author metadata. It enforces the same author
boundary and blocked-user list. GitHub history is the memory: no database or sessions.

Results are checked against the current commits and human discussion before
publication and always attributed to the captured commit. A subsequent push can
still race the final GitHub API call; GitHub then marks that review outdated.
The configurable inference budgets are estimates, not a provider billing cap.
Inspect failures and tool traces in Actions artifacts; no failure issues are spammed.
