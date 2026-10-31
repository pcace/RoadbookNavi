# Releasing RoadbookNavi

RoadbookNavi uses Semantic Release to keep application versions, the changelog,
Git tags, GitHub releases, and native artifacts in sync.

## Release channels

| Branch | Channel | Example          | GitHub status  |
| ------ | ------- | ---------------- | -------------- |
| `main` | Stable  | `v1.40.0`        | Latest release |
| `dev`  | Beta    | `v1.40.0-beta.1` | Prerelease     |

A push to either branch is analyzed after CI. Releasable Conventional Commits
create or update a version pull request from `codex/release-main` or
`codex/release-dev`. The PR contains the version changes, changelog and
`release-plan.json`. Review its CI and merge it yourself. Only then does the
workflow create the Git tag and GitHub release and start the Android, macOS,
Windows and Linux builds. The workflow never pushes commits to `main` or `dev`.

Each installer is built from that approved, tagged commit and uploaded to the
release. Additional changes on the target branch refresh the version PR and
require another merge before publication. Documentation, tests, maintenance and
build-only pushes wait for the next user-visible release.

In **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. The workflow uses
this setting only to create or update version PRs; it never approves or merges
them. The existing ruleset restricting `main` and `dev` updates to the maintainer
stays in place. No personal access token or release-app exception is needed.

The website links to `/releases/latest`, which GitHub resolves to the newest
stable release. Beta releases therefore never replace the public stable download.

## Release notes and versions

The release toolchain uses Semantic Release 26 beta, commit-analyzer 14 beta,
and release-notes-generator 15 beta to support Conventional Commits preset 10
and changelog writer 9. These upstream versions require Node.js 24.15 or newer.
`pnpm test:release` exercises commit analysis, release-note generation and the
version-PR lifecycle against local Git repositories that reject automated branch
updates. It does not publish GitHub releases.

Semantic Release builds the release overview and `CHANGELOG.md` from Conventional
Commit messages. In the usual squash-merge workflow, the pull request title is
the resulting commit message. Keep it short, specific, and useful to app users.

- `feat: add a route elevation preview` creates a minor version and appears
  under **New features**.
- `fix: restore trackpad scrolling in roadbooks` creates a patch version and
  appears under **Bug fixes**.
- `perf: render long roadbooks incrementally` creates a patch version and
  appears under **Performance improvements**.
- `refactor:`, `docs:`, `build:`, and `ci:` are shown in their matching sections
  in the next release without triggering a release on their own.
- `feat!:` or a `BREAKING CHANGE:` footer creates a major version.
- `test:` and `chore:` remain out of the user-facing notes.

The PR-title workflow comments on and closes pull requests that do not follow
this structure. They can be reopened after the title is corrected. Review the
title before merging because it becomes the changelog and GitHub release
description.

## Promoting a beta

Merge the tested `dev` changes into `main`. The release workflow prepares a
stable version PR from the changes since the previous stable tag. Merge that PR
to publish the stable build. Merge or rebase `main` back into `dev` afterwards so
development starts from the published stable version.

## Rebuilding failed artifacts

Open **Actions → Release RoadbookNavi → Run workflow**, select the branch that
owns the release, and enter its existing tag in `release_tag`. This rebuilds and
replaces the installers without creating another version.
