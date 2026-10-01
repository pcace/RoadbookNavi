# Help & Documentation

## Local data

When calculating a route, RoadbookNavi automatically downloads missing BRouter
routing segments and the OpenFreeMap tiles used for intersection drawings. Data
is stored on the device and reused by later roadbooks. Saved roadbooks and
previously downloaded routing data remain available without a connection. A new
route in a previously unused area and the online map require a connection.

## Planning roadbooks

Add, move or remove waypoints on the map. Routing profiles determine the route. The bundled Enduro profiles can be supplemented with your own `.brf` files in Settings.

These videos were recorded in the web version; some menus and map styles differ in the native app.

### Routing profiles

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/routeprofiles.mp4" type="video/mp4"></video>

### Editing waypoints

<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/movecreatedelete.mp4" type="video/mp4"></video>

### Address search

Submit a search using Enter or the search button. Address search is unavailable without an online provider; waypoints can still be placed directly on the map.
<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/adresssearch.mp4" type="video/mp4"></video>

### Surfaces

Coloured route segments use BRouter/OSM tags. Missing `surface` values are inferred from `tracktype` and road class, as in the web version. Unknown does not mean offroad.
<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/analysis.mp4" type="video/mp4"></video>

### Existing roadbooks

Select a saved roadbook in the planner to edit it. Filter the list by name and sort by date, name or distance. Date means last modification; unknown distances sort last.
<video controls preload="metadata" loop muted playsinline><source src="/help/img/small/loadRoadbook.mp4" type="video/mp4"></video>

## Navigation and export

Navigation uses a continuous roll PDF. Configure auto-follow, step-by-step or continuous scrolling and key bindings in Settings.

<img src="/help/img/small/autofollow.png" alt="Auto-follow">

**Save** in the roadbook list offers RN2, GPX, GeoJSON, A5 PDF and roll PDF. RN2 preserves drawings and is suitable for sharing roadbooks as files. GPX/GeoJSON carry the track. Use **Open (.rn2)** to import a received file.
