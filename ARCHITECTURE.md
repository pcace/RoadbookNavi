# Architecture

RoadbookNavi has one React/TypeScript interface with two runtimes: an installed
Tauri app and a browser app. There is no RoadbookNavi account, synchronisation
service or project server. Browser routing and optional place search use external
services. User instructions live in [the handbook](public/help/en.md)
([German](public/help/de.md)); this document describes the implementation.

## Interface and navigation

The entry point installs native geolocation adapters where needed, then mounts a
HashRouter. The main areas are the roadbook viewer, route planner, project list,
settings and help at **#/app/help**. Help chapter links use a **section** query
parameter inside the hash route. Visited areas remain mounted so switching areas
can retain their local state. Opening help preserves the origin route and active
odometer session; chapter navigation retains the return path in router state.

**src/ui** contains the screens, stores, localisation and presentation code.
**src/ui/services/localProjects.ts** adapts the project model to the UI and
performs route loading, generation and export. Shared interfaces in
**src/services.ts** call **src/platform.ts**, which dispatches to Tauri commands
or lazily loads **src/web.ts**.

The planner changes waypoints, routing profiles and project metadata. It does
not provide a drawing or instruction editor, or a user-facing profile importer.
RN2 diagrams can be retained across imports and compatible route changes;
retaining imported content is separate from editing it in the interface.

## Platform services

| Capability                   | Installed app                                     | Browser                                      |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------- |
| Projects                     | JSON documents in local SQLite                    | Separate IndexedDB project database          |
| Routing                      | Bundled BRouter engine on the device              | brouter.de with the selected bundled profile |
| Routing data                 | Persistent, automatically downloaded RD5 segments | No local routing engine or RD5 cache         |
| Intersection data            | Persistent MVT cache through Rust                 | Cache API, with network fallback             |
| File selection and saving    | Native dialogs and filesystem                     | Browser file input and downloads             |
| GPS                          | Platform-specific location adapter or webview     | Browser geolocation                          |
| UI and geocoding preferences | Local webview storage                             | Local browser storage                        |

Desktop builds run the prepared Java BRouter engine as a local process. Android
calls the routing engine in process through **native/tauri-plugin-brouter**.
**scripts/build-routing-engine.mjs** assembles the pinned upstream engine,
bundled profiles, runtime and notices.

Android geolocation uses the Tauri plugin. macOS uses the Rust CoreLocation
bridge. Windows and Linux use their webview geolocation implementation.
The navigation odometer integrates usable location readings; compass readings
may provide heading while stationary. Background operation and screen wake-lock
support must be tested on real devices.

## Planning and roadbook generation

1. The planner calculates a preview from at least two ordered waypoints and a
   selected profile. GPX template import simplifies a track into routing
   waypoints and keeps the original track as an underlay. The recalculated
   result need not match the GPX exactly.
2. Native routing derives required 5° RD5 segments, downloads missing segments,
   and retries if BRouter requests another segment. The browser sends waypoints
   to brouter.de and uploads bundled Enduro profile contents. Uploaded profile
   IDs are cached by content hash and renewed if the server removes them.
3. Route parsing and turn detection run in the platform-independent core. Worker
   code supports turn processing; project generation in **src/generate.ts**
   prepares roadbook entries and their drawings.
4. OpenFreeMap z14 MVT tiles cover the intersection windows. The native cache is
   keyed by planet version; the browser uses its tile cache. TypeScript decodes
   the tiles into background roads, buildings, railways and water. The travelled
   route and arrows come from BRouter.
5. Saving in the planner creates or updates a local project. Opening or exporting
   it prepares missing roadbook entries as needed. The floppy-disk **Save**
   action in the list exports a file; it is distinct from project persistence.
6. **src/export.ts** generates PDF layouts. The navigation viewer uses a
   continuous layout split into manageable screen chunks, with entry markers
   and a lightweight navigation index. PDF previews are cached in IndexedDB.
7. RN2 is the full roadbook interchange format. GPX and GeoJSON export the track;
   PDF exports printable A5 or continuous-roll layouts. GPX is also accepted as
   a planning template; GeoJSON and PDF are not project import formats.

## Local data and online dependencies

Native projects live in **library.sqlite** under the app data directory. RD5 and
MVT caches are separate from projects. Browser projects, generated previews,
browser caches and local preferences have distinct storage lifetimes.

Clearing previews removes derived PDFs and indexes. Clearing geographic caches
removes data that may need downloading again. The in-app reset clears previews
and local/session preferences while preserving projects and geographic caches.
Clearing browser website data can remove projects as well.

The web app has no service worker or supported offline cold start. Already
loaded and generated roadbooks can remain usable while the page stays open.
Native offline calculation requires the appropriate cached routing data;
generating new drawings also needs their tile data. The planning map and new
place lookup require network access.

Place search uses a configurable Nominatim-compatible service. Native requests
are cached in SQLite and browser requests in the Cache API. Preferences,
including a user-provided token, stay in local webview/browser storage. Search
and reverse lookup transmit query text or coordinates to the configured
provider. See [place search](Documentation/offline-geocoding.md).

## Current display limitations

PDF distance cells use a fixed 200 m threshold for near-entry highlighting.
The adjustable close-distance preference is stored but is not consumed by the
PDF generator. The auto-follow hotkey preference is also exposed but currently
has no active key handler. Manual scroll keys do not automatically disable
auto-follow; the footer location button is the working toggle.

The handbook and inline descriptions must distinguish working controls from
these settings. Do not infer availability from a stored setting or an unused
component. The active navigation UI is **src/ui/components/Roadbook.tsx**;
**src/Navigation.tsx** is not mounted by the current application.

## Help and website publishing

**public/help/de.md** and **public/help/en.md** are the canonical user guides.
They use relative image links and ordinary Markdown headings, so they also work
on GitHub. **src/ui/utils/helpMarkdown.ts** renders the same sources in the app
and during the static website build. Thumbnails link to full annotated images;
the help UI enhances those links into an accessible image dialog.

**pnpm build:web** copies the landing page from **docs**, builds the browser app
under **/app/**, and generates public HTML help under **/help/de/** and
**/help/en/** with **scripts/build-help.mjs**. Static help includes its full
article and chapter links in the HTML; reading does not require the application
or JavaScript. Search and image enlargement are progressive enhancements.

**.github/workflows/pages.yml** publishes the production site from **main** to
**roadbooknavi.de**, including the web app and help. It updates direct installer
links using the latest published stable release. **dev** is the prerelease
channel; there is no separate beta website deployment. Native release builds
and assets are managed by **.github/workflows/release.yml**; see
[RELEASING.md](RELEASING.md).

## Code boundaries

- **src/core** holds pure route parsing, geometry, turn detection, SVG and RN2
  algorithms. Keep it independent of React, browser storage and Tauri.
- **src-tauri** owns native persistence, downloads, cache management, routing
  process integration, geocoding and OS location access.
- Keep platform calls behind service interfaces and store schema versions with
  persistent documents.
- Preserve RN2 source fields and drawings where supported. The original file is
  never modified. See [RN2 behaviour](Documentation/rn2-rendering-and-sources.md).
- Keep user guides focused on tasks. Update both languages and verify image
  links when controls change; see [CONTRIBUTING.md](CONTRIBUTING.md).
- Preserve third-party notices and licenses. New application code is
  GPL-3.0-only; bundled components retain their own terms.
