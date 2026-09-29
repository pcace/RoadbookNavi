# Contributing

Contributions are welcome through GitHub issues and pull requests. Before making
a large architectural change, open an issue so the data model and cross-platform
impact can be discussed first.

By submitting a contribution, you agree that it may be distributed under the
[GNU General Public License v3.0 only](LICENSE). Contributions must be your own
work or compatible code that you are authorized to contribute. Do not copy code,
artwork, or data from sources whose terms are incompatible with GPL-3.0.

## Setup

Install Node.js 20+, pnpm 10+, Rust, and JDK 17, then run:

```bash
pnpm install
pnpm dev
```

A sibling checkout of [BRouter](https://github.com/abrensch/brouter) is used by
default. Set `BROUTER_SOURCE` when it lives elsewhere.

## Development workflow

1. Create a focused branch from the current development branch.
2. Keep platform-independent logic in `src/core`.
3. Keep comments, identifiers, commit messages, and developer documentation in
   English. User-visible text belongs in both locale files.
4. Do not commit OSM extracts, RD5 segments, build output, signing material,
   generated runtimes, or local configuration.
5. Run the relevant focused tests while working, then run the full checks below.
6. Describe behavior changes, migration effects, and manual platform testing in
   the pull request.

```bash
pnpm format:check
pnpm type-check
pnpm test
pnpm build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Changes to BRouter integration should record the upstream commit and preserve its
MIT license. Changes to bundled art or map styles must include source and license
information in `THIRD_PARTY_NOTICES.md` or next to the asset. New project-owned
code should use `SPDX-License-Identifier: GPL-3.0-only` when a source header is
appropriate; generated files and third-party material retain their original
notices.
