import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import liberty from '../../../map-presets/liberty.json';
import bright from '../../../map-presets/bright.json';
import positron from '../../../map-presets/positron.json';
import dark from '../../../map-presets/dark.json';
import fiord from '../../../map-presets/fiord.json';
export type MapStyleId =
  | 'open_street_map'
  | 'osm_bright'
  | 'osm_positron'
  | 'osm_dark'
  | 'osm_fiord'
  | 'osm_3d'
  | 'natural_earth'
  | 'osm_offline';
export const MAP_STYLES = [
  {
    id: 'open_street_map',
    labelKey: 'mapPresets.liberty',
    labelDefault: 'OSM · Liberty',
  },
  {
    id: 'osm_bright',
    labelKey: 'mapPresets.bright',
    labelDefault: 'OSM · Bright',
  },
  {
    id: 'osm_positron',
    labelKey: 'mapPresets.positron',
    labelDefault: 'OSM · Positron',
  },
  { id: 'osm_dark', labelKey: 'mapPresets.dark', labelDefault: 'OSM · Dark' },
  {
    id: 'osm_fiord',
    labelKey: 'mapPresets.fiord',
    labelDefault: 'OSM · Fiord',
  },
  { id: 'osm_3d', labelKey: 'mapPresets.3d', labelDefault: 'OSM · Liberty 3D' },
  {
    id: 'natural_earth',
    labelKey: 'mapPresets.relief',
    labelDefault: 'Natural Earth · Relief',
  },
  {
    id: 'osm_offline',
    labelKey: 'mapPresets.offline',
    labelDefault: 'Offline · Gebietsdaten',
  },
] as const;
const attribution =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const localSource = {
  type: 'geojson' as const,
  data: { type: 'FeatureCollection' as const, features: [] },
  attribution,
};
const localLayers: LayerSpecification[] = [
  {
    id: 'local-areas',
    type: 'fill',
    source: 'local-osm',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': [
        'case',
        ['has', 'building'],
        '#c6beb3',
        ['==', ['get', 'natural'], 'water'],
        '#9ccbd7',
        '#d4ddc5',
      ],
      'fill-opacity': 0.85,
    },
  },
  {
    id: 'local-water',
    type: 'line',
    source: 'local-osm',
    filter: ['has', 'waterway'],
    paint: { 'line-color': '#83b4c7', 'line-width': 2 },
  },
  {
    id: 'local-road-border',
    type: 'line',
    source: 'local-osm',
    filter: ['has', 'highway'],
    paint: {
      'line-color': '#b0a99c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 7],
    },
  },
  {
    id: 'local-roads',
    type: 'line',
    source: 'local-osm',
    filter: ['has', 'highway'],
    paint: {
      'line-color': [
        'match',
        ['get', 'highway'],
        ['motorway', 'trunk', 'primary'],
        '#efc571',
        ['track', 'path'],
        '#bca27b',
        '#fffef5',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 15, 5],
    },
  },
  {
    id: 'local-railway',
    type: 'line',
    source: 'local-osm',
    filter: ['has', 'railway'],
    paint: {
      'line-color': '#8a8a86',
      'line-width': 1,
      'line-dasharray': [3, 2],
    },
  },
  {
    id: 'local-road-labels',
    type: 'symbol',
    source: 'local-osm',
    minzoom: 13,
    filter: ['all', ['has', 'highway'], ['has', 'name']],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'symbol-spacing': 300,
    },
    paint: {
      'text-color': '#55504a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  },
  {
    id: 'local-place-labels',
    type: 'symbol',
    source: 'local-osm',
    filter: ['all', ['has', 'place'], ['has', 'name']],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['match', ['get', 'place'], 'city', 18, 'town', 16, 13],
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#333333',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  },
];
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: '/map-fonts/{fontstack}/{range}.pbf',
  sources: { 'local-osm': localSource },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f2f1ed' },
    },
    ...localLayers,
  ],
};
export function getMapStyleSpec(
  id: string = 'open_street_map'
): StyleSpecification {
  if (id === 'osm_offline') return structuredClone(OFFLINE_STYLE);
  if (id === 'natural_earth')
    return {
      version: 8,
      sources: {
        relief: {
          type: 'raster',
          tiles: [
            'https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 6,
          attribution:
            'Natural Earth · <a href="https://openfreemap.org">OpenFreeMap</a>',
        },
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#aad3df' },
        },
        { id: 'relief', type: 'raster', source: 'relief' },
      ],
    };
  const presets: Record<string, unknown> = {
    open_street_map: liberty,
    osm_bright: bright,
    osm_positron: positron,
    osm_dark: dark,
    osm_fiord: fiord,
    osm_3d: liberty,
  };
  const preset = structuredClone(presets[id] || liberty) as StyleSpecification;
  preset.metadata = {
    ...((preset.metadata as Record<string, unknown>) || {}),
    'roadbooknavi:3d': id === 'osm_3d',
  };
  return preset;
}
export function getMapStyleAttributionHtml(id: string = 'open_street_map') {
  return id === 'osm_offline'
    ? 'BRouter (MIT)'
    : '<a href="https://openfreemap.org">OpenFreeMap</a> · <a href="https://openmaptiles.org">© OpenMapTiles</a> · ' +
        attribution +
        ' · BRouter (MIT)';
}
