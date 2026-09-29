# RN2 rendering and source notes

Last updated: 2026-09-28.

## Research material

The RN2 implementation was developed from user-provided sample files and format
inspection. The original sample files are not part of this repository.

Rally Navigator 2.5.2 was inspected to understand coordinates, curve parameters,
road styles, and colors. No Rally Navigator program code or image assets are
included. Its installed package declares itself unlicensed and copyrighted, so
public availability was not treated as permission to redistribute its assets.

RoadbookNavi uses the FIA/Tulip symbols stored in `assets/fia-symbols`.
Their source and GPL-2.0 license are documented next to the files. The curve
solver is an independent implementation of natural cubic interpolation. Glyphs
marked as noncommercial by their upstream metadata are excluded; imports use the
generic missing-symbol fallback for those names.

## Import behavior

`roadOut.start` defines the absolute center of a drawing. Track endpoints, curve
control points, and road coordinates are relative to that center. The standard
anchor is `(99.5, 84)` and the lowered layout uses `y = 94`.

RN2 handles are interpolation points of a natural cubic spline rather than
Bezier control points. The parameter grows with the square root of chord length,
and previews use 60 segments. The renderer supports colors, dashes, multi-layer
roads, highlighted tracks, endpoint arrows, and distance markers.

Embedded SVG and PNG symbols are sanitized before PDF generation. External image
URLs and scripts are not loaded. Notes wrap according to their available width.
Smart tags, manual distance corrections, and unknown custom symbols remain known
format limitations.

The complete original RN2 document is retained. Exporting an unchanged import
preserves its drawings and only applies user edits such as a renamed roadbook.

### Editing an imported route

All visible entries become editable waypoints. Older imports containing only
start and finish points are expanded when read. An unchanged route reuses its
stored track without running routing or requiring downloaded region data.

After an edit, the source document remains available as `rn2Source`, while the
new route preview supplies the track used for regeneration. A drawing is retained
only when its center is within 3 meters of the new track point and samples up to
60 meters before and after it also remain within 3 meters. Changed approaches,
departures, positions, and directions discard the old drawing. This conservative
rule prevents stale graphics from being placed over changed intersections.

Retained entries receive updated cumulative distances while keeping their symbols
and notes. New turns use locally generated OSM drawings. The source RN2 file on
disk is never modified.

## Export behavior

Background roads are exported as RN2 line paths with straight segments. Multiple
road layers remain separate, and their order and corners are preserved. The main
track remains an editable track object with endpoints and an arrow.

Closely spaced support points around corners limit Rally Navigator's automatic
rounding. This is an approximation rather than a mathematically identical
polyline. Native geometry created by older RoadbookNavi versions receives the
same adjustment; newly generated geometry uses version 2.

The pure RN2 import and export helpers live in `src/core` and are used directly
by the native application.

## Verification

Regression tests cover structured round trips, anchor positions, curve endpoints,
styles and colors, straight background paths, curve deviation, edited approaches,
moved points, direction changes, updated distances, and retained drawings. A
visual comparison in Rally Navigator remains useful when extending the format.
