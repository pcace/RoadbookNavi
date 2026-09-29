# RN2 File Format Documentation

## Overview

RN2 (Rally Navigator 2) is a JSON-based file format for roadbook navigation, developed for the Rally Navigator 2 app. This documentation describes the structure and implementation of the RN2 export in RoadbookNavi.


**Version**: 4 
**Content-Type**: `application/octet-stream`  
**File Extension**: `.rn2`

---

## Top-Level Structure

```json
{
  "route": {
    "version": 4,
    "name": "Route Name",
    "description": "Route description with metadata",
    "current_style": "cross_country",
    "startlocation": "Location string",
    "endlocation": "Location string",
    "waypoints": [...],
    "settings": {...}
  }
}
```

### Route Properties

| Property | Type | Description |
|----------|------|-------------|
| `version` | number | RN2 format version (currently 4) |
| `name` | string | Route name from user input |
| `description` | string | Auto-generated metadata (turn count, creator, locations) |
| `current_style` | string | Display style, fixed to "cross_country" |
| `startlocation` | string | Geocoded start location or coordinates |
| `endlocation` | string | Geocoded end location or coordinates |
| `waypoints` | array | Array of waypoint objects (see below) |
| `settings` | object | Display and format settings (see below) |

---

## Waypoint Structure

Each waypoint represents a potential turn point in the roadbook, or better each waypoint represents a point on for example an imported gpx track:

```json
{
  "waypointid": 0,
  "showCoordinates": false,
  "showHeading": false,
  "showStickMarkOnTulip": false,
  "lat": 48.12345,
  "lon": 11.12345,
  "ele": 500,
  "show": true,
  "tulip": {
    "elements": [...]
  },
  "notes": {
    "elements": []
  },
  "overridenSmartTags": {
    "dataType": "Map",
    "value": []
  }
}
```

### Waypoint Properties

| Property | Type | Description |
|----------|------|-------------|
| `waypointid` | number | Sequential index starting from 0 |
| `lat` | number | Latitude in decimal degrees |
| `lon` | number | Longitude in decimal degrees |
| `ele` | number | Elevation in meters |
| `show` | boolean | Whether this waypoint has tulip data (only then it will generate an entry in the roadbook) |
| `tulip.elements` | array | SVG-like elements for the turn visualization |
| `notes.elements` | array | Additional notes (currently unused) |
| `overridenSmartTags` | object | Custom tags (currently unused) |

---

## Tulip Structure

The tulip is the visual representation of a turn. It consists of different element types stored as SVG-like objects.

## coordinate system:
The Tulip is 200x130px. 0,0 is the top left corner

### Element Types

#### 1. Track Element

The track element shows the main travel route with incoming and outgoing roads:

```json
{
  "type": "Track",
  "roadIn": {
    "end": {"x": -50, "y": -10},
    "handles": [{"x": -30, "y": -30}],
    "typeId": 17,
    "z": 10
  },
  "roadOut": {
    "start": {"x": 100, "y": 90},
    "end": {"x": 50, "y": -10},
    "handles": [{"x": 30, "y": -30}],
    "typeId": 17,
    "z": 10
  },
  "z": 10,
  "eId": "uuid-string",
  "rerender": false 
}
```

**Properties**:
- **Turn Center Point**: Defined by `roadOut.start` in global coordinates (200x130)
  - Example: `{"x": 100, "y": 90}` means center of the tulip horizontally, slightly below center vertically
- `roadIn`: Incoming road (ends at the turn center point)
  - `end`: End point relative to `roadOut.start` (where the road comes from)
  - `handles`: Intermediate curve points relative to `roadOut.start`
- `roadOut`: Outgoing road (starts at the turn center point)
  - `start`: **Absolute** position in global coordinates (turn center point)
  - `end`: End point relative to `start` (where the road goes to)
  - `handles`: Intermediate curve points relative to `start`
- `typeId`: Road type identifier (see Road Types)
- `z`: Z-index for layering (10 = top layer)

**Coordinate System**:
- All coordinates in `roadOut.start` are absolute (0-200 for x, 0-130 for y)
- All coordinates in `end` and `handles` are **relative** to `roadOut.start`
- Example: If `start = {x: 100, y: 90}` and `end = {x: 5, y: 5}`, the absolute position is `{x: 105, y: 95}`

#### 2. Line Element

Line elements are used for custom svg images / drawings:

```json
{
  "type": "Line",
  "eId": "uuid-string",
  "path": [
    ["M", 10, 20],
    ["L", 30, 40],
    ["L", 50, 30],
    ["L", 10, 20]
  ],
  "dirty": true,
  "fill": "transparent",
  "stroke": "#636363ff",
  "strokeWidth": 2,
  "strokeLineCap": "round",
  "rerender": false,
  "z": 3,
  "pathOffset": {"x": 0, "y": 0}
}
```

**Properties**:
- `path`: SVG path array in format `[Command, x, y]`
  - `M`: MoveTo (starting point)
  - `L`: LineTo (line to point)
- `stroke`: Line color
  - Buildings: `#636363ff` (gray)
  - Waterways: `#A9D3EF` (light blue)
- `strokeWidth`: Line width in pixels
- `fill`: Fill color (usually "transparent")
- `z`: Z-index (3 = middle layer)


#### 3. Road Element

Road elements represent other streets:

```json
{
  "type": "Road",
  "start": {"x": -40, "y": 30},
  "end": {"x": 40, "y": 30},
  "handles": [{"x": 0, "y": 35}],
  "typeId": 17,
  "z": 4,
  "eId": "uuid-string",
  "rerender": false
}
```

**Properties**:
- `start`: Starting point of the road
- `end`: End point of the road
- `handles`: Intermediate points for curves
- `typeId`: Road type (see Road Types)
- `z`: Z-index (4 = above Line elements, below Track)

### Road Type IDs

Mapping of OSM road types (in raodbooknavi.de) to RN2 Type IDs:

| OSM Type | Type ID | Description |
|----------|---------|-------------|
| `path` | 15 | Footpath/Trail |
| `track` | 16 | Unpaved track |
| `residential` | 4 | Residential street |
| `tertiary` | 17 | Tertiary road |
| `secondary` | 18 | Secondary road |
| `highway` | 12 | Highway/Motorway |
| *default* | 4 | Default road type |

---

## Settings Object

```json
{
  "units": "metric",
  "showHighlight": true,
  "showDistanceTickMark": true,
  "showCoordinates": true,
  "coordFormat": 1,
  "showHeadings": true,
  "showAlternateDistance": true,
  "showControlPointDetails": true,
  "hundredthsStyle": "on",
  "showControlPointOrdinals": true,
  "trackColor": 0,
  "defaultTrackType": 4,
  "customHeaderImage": "data:image/png;base64,..."
}
```

### Settings Properties

| Property | Type | Description |
|----------|------|-------------|
| `units` | string | "metric" or "imperial" |
| `showHighlight` | boolean | Show highlighted elements |
| `showDistanceTickMark` | boolean | Show distance markers |
| `showCoordinates` | boolean | Show GPS coordinates |
| `coordFormat` | number | Coordinate format (1 = decimal degrees) |
| `showHeadings` | boolean | Show heading arrows |
| `customHeaderImage` | string | Base64-encoded PNG image (optional) |

---


## Complete Example

```json
{
    "route": {
        "version": 4,
        "name": "Test Route",
        "description": "5 turns, created by user@example.com",
        "current_style": "cross_country",
        "startlocation": "Munich, Germany",
        "endlocation": "Innsbruck, Austria",
        "waypoints": [
            {
                "waypointid": 0,
                "showCoordinates": false,
                "showHeading": false,
                "showStickMarkOnTulip": false,
                "lat": 48.1351,
                "lon": 11.582,
                "ele": 510,
                "show": true,
                "tulip": {
                    "elements": [
                        {
                            "type": "Line",
                            "eId": "a1b2c3d4",
                            "path": [
                                [
                                    "M",
                                    0,
                                    0
                                ],
                                [
                                    "L",
                                    200,
                                    130
                                ]
                            ],
                            "fill": "transparent",
                            "stroke": "#636363ff",
                            "strokeWidth": 2,
                            "z": 3,
                            "pathOffset": {
                                "x": -20,
                                "y": 0
                            },
                            "rerender": false
                        },
                        {
                            "type": "Track",
                            "roadIn": {
                                "end": {
                                    "x": -20,
                                    "y": 20
                                },
                                "handles": [
                                    {
                                        "x": -10,
                                        "y": 10
                                    }
                                ],
                                "typeId": 17,
                                "z": 10
                            },
                            "roadOut": {
                                "end": {
                                    "x": 20,
                                    "y": -20
                                },
                                "handles": [
                                    {
                                        "x": 10,
                                        "y": -5
                                    }
                                ],
                                "typeId": 17,
                                "z": 10,
                                "start": {
                                    "x": 100,
                                    "y": 90
                                }
                            },
                            "eId": "e5f6g7h8",
                            "rerender": false,
                            "selected": true,
                            "selection": "track-out"
                        }
                    ]
                },
                "notes": {
                    "elements": []
                },
                "overridenSmartTags": {
                    "dataType": "Map",
                    "value": []
                },
                "t_uuid": "wpt_uuid_edd76fed-9972-4a94-aa38-a58e2984fb1c"
            }
        ],
        "settings": {
            "units": "metric",
            "showHighlight": true,
            "showDistanceTickMark": true,
            "showCoordinates": true,
            "coordFormat": 1,
            "showHeadings": true,
            "showAlternateDistance": true,
            "showControlPointDetails": true,
            "hundredthsStyle": "on",
            "showControlPointOrdinals": true,
            "trackColor": 0,
            "defaultTrackType": 4,
            "customHeaderImage": "data:image/png;base64,iVBORw0KGgo..."
        }
    }
}
```