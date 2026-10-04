# Native platforms and RN2

RoadbookNavi is one local-first Tauri application. React and TypeScript implement
the interface and roadbook workflow, Rust stores projects and imported OSM data,
and the bundled BRouter engine calculates routes on the device. The application
does not depend on a RoadbookNavi service or account system.

## Platform status

| Platform      | Implementation                                                         | Release output   |
| ------------- | ---------------------------------------------------------------------- | ---------------- |
| macOS ARM64   | Tauri, Rust, and bundled desktop Java                                  | DMG              |
| Windows x64   | Same UI and Rust code with bundled Java                                | NSIS installer   |
| Linux x64     | Same UI and Rust code with bundled Java                                | AppImage and DEB |
| Android ARM64 | Same UI and Rust storage, BRouter through the Android Java bridge      | Signed APK       |
| iOS           | Not implemented; the Java routing engine needs a different integration | None             |

CI builds all supported desktop targets and Android when Release Please creates a
release. Hardware tests remain necessary for GPS, file dialogs, large map-data
imports, suspend/resume, and route calculation.

## Project exchange through RN2

RN2 import and export provide account-free project exchange. A file can be sent
through any file transfer service and imported from the roadbook list. Version 4
is supported. Unknown document fields, embedded images, control point data, and
unmodified drawings are retained for round trips.

Imported visible entries become editable route waypoints. If the route geometry
around an entry changes, its custom drawing is discarded and regenerated from
local OSM data. Unchanged drawings remain intact. Editing or regenerating a route
requires the relevant map and routing data to be cached.

RN2 files may reference icons that are not embedded. RoadbookNavi maps known
symbols to the bundled FIA/Tulip set. Unsupported private icons are represented
without downloading external resources. See
[RN2 rendering and sources](rn2-rendering-and-sources.md) for details.
