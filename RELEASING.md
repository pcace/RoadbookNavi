# Releasing RoadbookNavi

RoadbookNavi uses Semantic Release to keep application versions, the changelog,
Git tags, GitHub releases, and native artifacts in sync.

## Release channels

| Branch | Channel | Example          | GitHub status  |
| ------ | ------- | ---------------- | -------------- |
| `main` | Stable  | `v1.40.0`        | Latest release |
| `dev`  | Beta    | `v1.40.0-beta.1` | Prerelease     |

A push to either branch is analyzed after CI. If it contains a releasable
Conventional Commit, the workflow creates the version commit, Git tag, changelog,
and GitHub release. It then starts the Android, macOS, Windows, and Linux builds.
Each build is checked out from the new version tag and uploads its installer to
that release. Documentation, tests, maintenance, and build-only pushes wait for
the next user-visible release and do not start expensive native builds by
themselves.

The website links to `/releases/latest`, which GitHub resolves to the newest
stable release. Beta releases therefore never replace the public stable download.

## Release notes and versions

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

The PR-title workflow rejects titles that do not follow this structure. Review
the title before merging because it becomes the changelog and GitHub release
description.

## Promoting a beta

Merge the tested `dev` changes into `main`. The release workflow collects the
changes since the previous stable tag, removes the prerelease suffix, and
publishes the stable build. Merge or rebase `main` back into `dev` afterwards so
development starts from the published stable version.

## Rebuilding failed artifacts

Open **Actions → Release RoadbookNavi → Run workflow**, select the branch that
owns the release, and enter its existing tag in `release_tag`. This rebuilds and
replaces the installers without creating another version.
