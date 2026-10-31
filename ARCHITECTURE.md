# Architecture

RoadbookNavi is one native application with no application server. The code is
split by responsibility so platform-independent roadbook logic remains testable
without Tauri.

## Components

### Browser beta

`src/platform.ts` dispatches service commands to Tauri in native builds and lazily
loads `src/web.ts` in browsers. The web adapter stores projects in a separate
IndexedDB database, caches OpenFreeMap tiles using the Cache API, and uses
brouter.de with the same `native/profiles/*.brf` files and `timode=3`. Uploaded
profile IDs are cached by content hash and renewed if the server removes them.
`src/files.ts` selects native file dialogs or browser downloads. The native
engine and project schema are unchanged. Only `dev` deploys the web beta to
`beta.roadbooknavi.de`; `main` does not deploy the web app.

### `src`

The application shell and local feature services live here. Top-level modules
handle OpenFreeMap tile decoding, route generation, import/export, and native
bridges. `src/ui` contains screens, stores, translations, and presentation logic.
UI code should call the service interfaces instead of invoking Tauri commands
directly when a service already exists.

### `src/core`

Pure TypeScript algorithms for BRouter response parsing, turn detection, tulip
SVG generation, coordinate transforms, and RN2 documents. This directory must
remain independent of React, browser storage, Tauri, and operating-system APIs.

### `src-tauri`

The Rust host owns local persistence and operating-system integration. Its SQLite
library stores projects and preferences. Commands also manage the persistent MVT
and RD5 caches, geocoding, location access, and the desktop BRouter process.

### `native/brouter` and `native/tauri-plugin-brouter`

Desktop builds run the prepared BRouter Java engine locally. Android uses the
Tauri plugin to call the same routing code in process.
`scripts/build-routing-engine.mjs` collects the pinned upstream BRouter sources,
bundled profiles, license, and build resources for both targets.

## Data flow

1. Route planning derives the required 5° BRouter segments from the waypoints,
   downloads missing RD5 files, and sends the route to the local engine.
2. If BRouter reports another required segment while routing, that exact segment
   is downloaded and the calculation is retried.
3. The returned GeoJSON is parsed in `src/core`; a worker detects turns.
4. The app downloads the unique z14 OpenFreeMap MVT tiles covering the 420-metre
   turn windows. Rust stores the raw tiles by OpenFreeMap planet version, while
   TypeScript converts OpenMapTiles layers to the renderer's GeoJSON contract.
5. Tulip arrows and the travelled path come from BRouter. MVT data contributes
   surrounding roads, buildings, railways, and water only.
6. Projects are saved in the local SQLite library. Rendered PDFs are cached in
   IndexedDB because the PDF viewer consumes browser-native blobs.
7. RN2 is the editable interchange format. GPX, GeoJSON, and PDF are export-only
   formats.

## Design rules

- Keep routing, rendering, imports, and exports deterministic and local.
- Keep `src/core` free of UI and native runtime dependencies.
- Put platform access behind typed services or Tauri commands.
- Store schema versions with persistent documents and migrate at read boundaries.
- Preserve source and license notices for bundled data, styles, symbols, and
  routing engines.
- License new RoadbookNavi application code under GPL-3.0-only. Keep third-party
  code and assets clearly separated with their original licenses and attribution.
- Add regression tests for RN2 compatibility, geometry changes, and storage
  migrations; avoid tests that only mirror implementation details.
