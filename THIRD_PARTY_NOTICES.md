# Third-party notices

RoadbookNavi includes or accesses the components and data below. Each component
keeps its original license; the RoadbookNavi code license does not replace these
terms. The root GNU GPL v3.0 license covers RoadbookNavi's original application
code, not independently licensed third-party material listed here.

- **BRouter** provides local routing under the MIT License. The build pins an
  upstream revision in `native/brouter/resources/SOURCE.json` and preserves the
  license in `native/brouter/resources/BROUTER-LICENSE.txt`.
- **FIA/Tulip symbols** are separate artwork distributed under GPL-2.0 with
  additional per-glyph licenses and attribution. See
  `assets/fia-symbols/LICENSE-Tulip`, `source.md`, `GLYPHS.md`, and the metadata
  embedded in individual SVG files. Glyphs marked `CC BY-NC-SA` by upstream are
  intentionally not distributed with RoadbookNavi. The remaining asset terms
  continue to apply and are not replaced by RoadbookNavi's GPL-3.0 license.
- **OpenStreetMap data** is accessed through OpenFreeMap vector tiles under the
  Open Database License (ODbL). Required attribution remains visible in maps.
- **OpenFreeMap/OpenMapTiles vector tiles and styles** preserve their BSD, MIT,
  Creative Commons, and data notices in `src/map-presets/` and in the map UI.
- **Noto Sans map glyphs** use the SIL Open Font License. See
  `public/map-fonts/OFL.txt`.

The generated desktop runtime contains its own third-party notices. JavaScript,
Rust, and Java package licenses remain available from their upstream packages and
lockfiles.
