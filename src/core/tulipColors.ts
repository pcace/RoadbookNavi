// Centralized color palette for SVG/PDF roadbook export
// Keep this in sync with src/theme/colors.ts (useTulipColors)

export const TulipColors = {
  // Core map features (light theme defaults for PDF)
  highwayBase: '#000000',
  buildingFill: 'grey',
  buildingStroke: '#2c3e50',
  waterway: '#3498db',
  railway: '#34495e',
  turnPath: '#2986f5',
  svgBackground: 'none',
  svgFilter: 'none',

  // Additional OSM features
  powerLine: 'red',
  tree: '#27ae60',
  naturalWater: '#3498db',
  power: '#f39c12',
  well: '#34495e',
  trafficSign: '#e74c3c',

  // Special strokes for multi-line highways and indicators
  majorRoadOuter: '#000000',
  majorRoadInner: '#ffffff',
  turnIndicator: '#000000',
} as const;
