# OBF Spike — OsmAnd's prebuilt data as the offline region format

Prototype on branch `feat/rnregion-format` evaluates both paths from Issue #8.
This spike proves the **OBF path** (use OsmAnd's prebuilt map files directly).

## Result: both questions answered yes

**1. Data is available** — the exact endpoints the OsmAnd app uses:

- Catalog: `https://download.osmand.net/get_indexes?gzip` — XML (`osmand_regions`),
  ~8754 regions, rebuilt ~monthly. Parse: body is gzipped XML regardless of extension.
- Download: `https://download.osmand.net/download?event=2&file=<name>.obf.zip` (redirects).
- Example: `Germany_bremen-city_europe_2.obf.zip` → 28 MB zip → **57 MB OBF**
  (sections: Map 27.7 MB · Address 10.0 MB · POI 14.4 MB · Routing 5.6 MB · Transport 1.3 MB).

**2. The data is consumable** with their official reader (`osmand-java`,
GPLv3 — license-compatible with this repo's GPL-3.0-only; data is ODbL):

- `BinaryMapIndexReader` works headless in a plain JVM (deps: trove4j, kxml2 2.1.8,
  plus the resources from the `OsmAnd-resources` repo baked into the jar).
- Spike code (scratch clone in `/tmp/osmand-spike`, not part of this repo):
  `OsmAnd-tools/java-tools/ObfProbe/src/main/java/net/osmand/probe/ObfGeoJSON.java`
  - `geojson <obf> <w> <s> <e> <n>` → FeatureCollection for the offline style layers
  - `search <obf> <query>` → cities/streets from the Address section
- Reproduce: clone `osmandapp/OsmAnd-tools` + sibling `android/` layout with
  `osmandapp/OsmAnd` and `osmandapp/OsmAnd-resources`, run the
  `collect*Resources` tasks, then `:ObfProbe:run`.

## Measured (Bremen-city OBF, detail root only)

| bbox | objects seen | features (whitelisted) | JSON | time |
|---|---|---|---|---|
| downtown 8.795,53.072…8.83,53.10 | 34,463 | 17,273 | 4.4 MB | **521 ms** (incl. JVM init) |
| whole city 8.55,53.00…9.00,53.25 | 378,677 | 231,523 | 62 MB | **2,965 ms** |

kinds (downtown): 6,242 road segments, 9,118 buildings (all Polygon after the
tag-driven area fix), 1,217 railway, 110 waterway, 549 green, 18 water, 19 place.
Address search "Bahnhof" → structured street hits with city + coordinates.

## Integration-relevant findings

- **Area-ness is tag-driven, not object-driven**: OBF detail-level buildings come
  back as closed lines with `isArea() == false`; the bridge decides Polygon by
  kind (`building`/`water_area`/`green_area`/`sand_area`) + closed ring.
- Roads are stored per segment (6,242 segments vs. 5,017 whole ways) — MapLibre
  renders that fine; label dedup optional.
- Counts differ ~10 % from the rnregion prototype (city-boundary coverage and
  OBF's own simplification levels) — no data-quality concern for the map.
- Whole-city queries cost seconds; per-moveend bboxes are far smaller. Phase 1
  adds the same 20k-feature cap the previous SQLite flow had.
- Coordinate space is 31-bit tiles (`MapUtils.get31TileNumberX/Y`), same ~1e-6
  degree precision class as our format.
- Version pinning: OBF v2 + reader from OsmAnd master work today; pin the jars
  at integration time.

## Licensing (checked 2026-10-01)

- **Data (map OBF files)**: OBFs are a database derived from OpenStreetMap
  data; redistribution is governed by the **ODbL** (share-alike + attribution
  "© OpenStreetMap contributors") — the app already ships that attribution and
  is GPL-3.0-only, so nothing to change. OsmAnd adds no restrictive license on
  the files themselves (served freely, no auth, no click-through; no ToS page
  exists for the download server). We only consume `type=map` files — other
  OBF kinds (DEM/hillshade/depth, Wikipedia) carry separate, partly restrictive
  attributions (GEBCO/NOAA/JAXA, CC-BY-SA) and stay out.
- **Code (osmand-java jars in the bundle)**: GPLv3 (verified) — compatible with
  this repo's GPL-3.0-only. License notices ship with the jars (SOURCE.json
  provenance pattern, same as BRouter). We do not copy OsmAnd assets
  (their artwork is CC-BY-NC-ND / partly proprietary) — the OBF is only read at
  runtime; our styles and fonts stay our own.
- **Endpoint (download.osmand.net)**: a service, not a licensed resource. No
  prohibition exists (no ToS published), but no guarantee either. Self-imposed
  rules, built into the downloader: identifying User-Agent, no bulk crawling
  (catalog cached ~daily, one file per user action), tolerant error handling.
  The planned Contabo mirror removes the dependency; the catalog carries
  mirror-capable URLs from day one.
- The `free=false` index flag is OsmAnd's own app-business marker (the free
  flavor counts downloads of certain items, MAXIMUM_AVAILABLE_FREE_DOWNLOADS
  = 7 in their code) — not a license; the catalog parser ignores it.

## Consequences for Issue #8

- No converter of our own is needed for the product: OsmAnd's build farm
  produces and updates the full catalog; we download, mirror (Contabo) and read.
- No on-device conversion and no spilling: the rnregion writer/reader stays on
  this branch as reference (parity-proven, ~500-line reader) but is not merged
  into the app path.
- Phase 1 becomes a bridge job: desktop = resident JVM query service
  (stdio/TCP JSON), Android = Kotlin plugin calling `BinaryMapIndexReader`
  in-process (BRouter plugin pattern); `store.rs`/`osm.query` contract unchanged.
- Search upgrades for free: Address section (city → street → building) instead
  of a substring scan; POI section available if needed later.