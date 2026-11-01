# Contributing

Contributions are welcome through GitHub issues and pull requests. Before making
a large architectural change, open an issue so the data model and cross-platform
impact can be discussed first.

By submitting a contribution, you agree that it may be distributed under the
[GNU General Public License v3.0 only](LICENSE). Contributions must be your own
work or compatible code that you are authorized to contribute. Do not copy code,
artwork, or data from sources whose terms are incompatible with GPL-3.0.

## Setup

Install Node.js 24.15+, pnpm 10+, Rust, and JDK 17, then run:

```bash
pnpm install
pnpm dev
```

A sibling checkout of [BRouter](https://github.com/abrensch/brouter) is used by
default. Set `BROUTER_SOURCE` when it lives elsewhere.

## Development workflow

Repository skills are stored in `.agents/skills/<skill-name>/SKILL.md`.
For PDF library updates and viewer loading failures, follow
[update-pdf-runtime](.agents/skills/update-pdf-runtime/SKILL.md), which records
the recurring PDF.js worker version mismatch and the required rendering checks.

1. Create a focused branch from the current development branch.
2. Keep platform-independent logic in `src/core`.
3. Keep comments, identifiers, commit messages, and developer documentation in
   English. User-visible text belongs in every supported locale (`de`, `en`, `es`, and `fr`).
   Include the website and shared app/browser guide when changing user-facing
   copy. `pnpm test` checks locale keys, placeholders, and help media.
4. Use a Conventional Commit title for the pull request. `feat:` adds a feature,
   `fix:` fixes user-visible behavior, and `perf:` improves performance. Write the
   rest of the title so it can appear unchanged in the release notes. Pull
   requests with an invalid title are closed automatically and can be reopened
   after the title is corrected.
5. Do not commit OSM extracts, RD5 segments, build output, signing material,
   generated runtimes, or local configuration.
6. Run the relevant focused tests while working, then run the full checks below.
7. Describe behavior changes, migration effects, and manual platform testing in
   the pull request.

```bash
pnpm format:check
pnpm type-check
pnpm test
pnpm test:release
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

See [RELEASING.md](RELEASING.md) for the stable and beta release process.

## Maintain the user guide

The canonical handbooks are [German](public/help/de.md),
[English](public/help/en.md), [Spanish](public/help/es.md) and
[French](public/help/fr.md). Keep all task lists and limitations in sync.
Interface labels for app and static help share the locale JSON files; avoid
inline language checks in the help renderer or website scripts.
They are rendered in the app and by the public website build; do not maintain
separate native and web copies. Describe differences inside the relevant task.
The short legacy Markdown files only preserve old links.

Use ordinary Markdown headings and relative image links. Each thumbnail links
to its full-size annotated screenshot, so GitHub and readers without JavaScript
can open it too. Screenshots are real web app captures with a public example
route, not reconstructed interfaces. Original captures live under
public/help/images/originals. Numbered SVG arrow positions and preview crops
are recorded in [help-screenshots.json](Documentation/help-screenshots.json).
Run the local overlay preview with:

    node scripts/help-screenshot-overlays.mjs

Capture each full overlay page and its small preview from the browser into the
matching image filenames. Keep controls readable in the preview, check every
arrow against the actual control, and verify the enlarged image. Do not include
private coordinates, tokens or personal projects. The capture date and example
are in the manifest. Remove obsolete media references when replacing images.

After changing the guide or renderer, run:

    pnpm exec vitest run src/help.test.ts
    node --test scripts/help-site.test.mjs
    pnpm build:web

Preview the built site on a local HTTP server. Check all four languages, narrow
screens, chapter links, search, keyboard focus, Escape-to-close image previews
and the landing page's help links. Read the generated guide with JavaScript
disabled as well as the source Markdown. Native location and offline operation
still need separate hardware testing when their behaviour changes.
