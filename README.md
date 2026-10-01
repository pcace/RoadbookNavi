# RoadbookNavi

RoadbookNavi is a local-first route planner, roadbook editor, PDF generator, and
navigation app for macOS, Windows, Linux, and Android. Projects, routing, maps,
and generated roadbooks stay on the device. No RoadbookNavi account or server is
required.

## What it does

- caches OpenFreeMap vector tiles needed for roadbook drawings
- downloads BRouter routing segments automatically when a route needs them
- calculates routes on the device with BRouter and custom routing profiles
- creates, edits, renders, and navigates digital roadbooks
- imports and exports Rally Navigator 2 (`.rn2`) files
- exports GPX, GeoJSON, A5 PDF, and roll PDF files

Network access is used only to download routing and map data or to access the
optional Nominatim geocoding provider. Previously cached routes and roadbooks
remain available without a connection.

## Architecture

```text
src/                          React application and local feature services
src/core/                     Platform-independent roadbook and RN2 logic
src-tauri/                    Rust host and native platform integration
native/brouter/               BRouter adapter and prepared engine resources
native/profiles/              Bundled custom BRouter profiles
native/tauri-plugin-brouter/  Android bridge for in-process routing
Documentation/                File-format and asset documentation
docs/                         Static GitHub Pages website
```

The React application calls a small set of typed local services. Tauri stores
projects in SQLite, runs BRouter locally, and maintains independent RD5 and MVT
caches. See [ARCHITECTURE.md](ARCHITECTURE.md) for component boundaries and data
flows.

## Tech stack

- React 19, TypeScript, Vite, Chakra UI, Zustand
- Tauri 2 and Rust
- SQLite for local projects and geocoding responses
- OpenFreeMap/OpenMapTiles MVT data for roadbook backgrounds
- BRouter for local routing on desktop and Android
- MapLibre GL for map rendering
- Vitest for TypeScript tests and Cargo test for native tests

## Developer quick start

Requirements: Node.js 24.10+, pnpm 10+, Rust, and JDK 17. Android builds also need
the Android SDK/NDK and the `aarch64-linux-android` Rust target.

```bash
pnpm install
pnpm dev
```

Run the checks used for contributions:

```bash
pnpm format:check
pnpm type-check
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

Build native packages with `pnpm desktop:build`, `pnpm android:build`, or
`pnpm build:all`. `pnpm engine:build` compiles the bundled routing engine from a
sibling BRouter checkout by default; set `BROUTER_SOURCE=/path/to/brouter` to use
another checkout.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Stable and
beta versioning is documented in [RELEASING.md](RELEASING.md).

## License

RoadbookNavi is free and open-source software licensed under the
[GNU General Public License v3.0 only](LICENSE). You may use, study, modify, and
redistribute the software, including commercially, under the GPL terms. Source
code for distributed modified versions must remain available under the same
license. Separately licensed bundled assets remain subject to the terms listed in
the third-party notices; noncommercial-only upstream glyphs are excluded from
RoadbookNavi releases.

The canonical source repository is
[github.com/pcace/RoadbookNavi](https://github.com/pcace/RoadbookNavi). Preserve
the attribution in [NOTICE](NOTICE) when redistributing RoadbookNavi or a modified
version. Bundled third-party components and assets keep their own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
