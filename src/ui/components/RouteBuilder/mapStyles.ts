import type { StyleSpecification } from 'maplibre-gl';
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
  | 'natural_earth';
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
] as const;
const attribution =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export function getMapStyleSpec(
  id: string = 'open_street_map'
): StyleSpecification {
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
export function getMapStyleAttributionHtml(_id: string = 'open_street_map') {
  return (
    '<a href="https://openfreemap.org">OpenFreeMap</a> · <a href="https://openmaptiles.org">© OpenMapTiles</a> · ' +
    attribution +
    ' · BRouter (MIT)'
  );
}
