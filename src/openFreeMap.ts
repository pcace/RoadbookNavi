import { invoke } from '@tauri-apps/api/core';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { bboxClip, bboxPolygon, booleanIntersects } from '@turf/turf';
import type {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
} from 'geojson';
import type { Bbox } from './model';

const SOURCE_ZOOM = 14;
const DRAWING_LAYERS = [
  'transportation',
  'building',
  'water',
  'waterway',
] as const;

type TileId = { z: number; x: number; y: number };
type TileResponse = { data: string; version: string; cached: boolean };

const tilePromises = new Map<string, Promise<Uint8Array>>();

function tileX(longitude: number, zoom: number) {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function tileY(latitude: number, zoom: number) {
  const radians =
    (Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom
  );
}

export function tilesForBounds(bounds: Bbox, zoom = SOURCE_ZOOM): TileId[] {
  const [west, south, east, north] = bounds;
  if (
    !bounds.every(Number.isFinite) ||
    west > east ||
    south > north ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90
  ) {
    throw new Error('Ungültiger Kartenausschnitt');
  }
  const result: TileId[] = [];
  for (let x = tileX(west, zoom); x <= tileX(east, zoom); x += 1) {
    for (let y = tileY(north, zoom); y <= tileY(south, zoom); y += 1) {
      result.push({ z: zoom, x, y });
    }
  }
  return result;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function loadTile(tile: TileId): Promise<Uint8Array> {
  const key = `${tile.z}/${tile.x}/${tile.y}`;
  let promise = tilePromises.get(key);
  if (!promise) {
    promise = invoke<TileResponse>('get_map_tile', tile).then(response =>
      decodeBase64(response.data)
    );
    tilePromises.set(key, promise);
    promise.catch(() => tilePromises.delete(key));
  }
  return promise;
}

export function mapOpenMapTilesFeature(
  layer: string,
  feature: Feature<Geometry, GeoJsonProperties>
): Feature<Geometry, GeoJsonProperties> {
  const properties = { ...(feature.properties || {}) };
  if (layer === 'transportation') {
    if (properties.class === 'rail' || properties.class === 'transit') {
      properties.railway = properties.subclass || properties.class;
    } else {
      properties.highway = properties.subclass || properties.class;
    }
    if (properties.brunnel === 'bridge') properties.bridge = 'yes';
    if (properties.brunnel === 'tunnel') properties.tunnel = 'yes';
  } else if (layer === 'building') {
    properties.building = properties.class || 'yes';
  } else if (layer === 'water') {
    properties.natural = 'water';
    properties.water = properties.class || 'water';
  } else if (layer === 'waterway') {
    properties.waterway = properties.class || 'waterway';
  }
  return { ...feature, properties };
}

function clippedFeatures(
  feature: Feature<Geometry, GeoJsonProperties>,
  bounds: Bbox
): Feature<Geometry, GeoJsonProperties>[] {
  if (!booleanIntersects(feature, bboxPolygon(bounds))) return [];
  if (
    !['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(
      feature.geometry.type
    )
  ) {
    return [feature];
  }
  let clipped: Feature<Geometry, GeoJsonProperties>;
  try {
    clipped = bboxClip(feature as never, bounds as BBox) as typeof feature;
  } catch {
    clipped = feature;
  }
  if (clipped.geometry.type !== 'MultiLineString') return [clipped];
  const properties = clipped.properties;
  return (clipped.geometry as MultiLineString).coordinates.map(coordinates => ({
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates } as LineString,
  }));
}

async function decodeTile(
  tile: TileId,
  bounds: Bbox
): Promise<Feature<Geometry, GeoJsonProperties>[]> {
  const vectorTile = new VectorTile(new Pbf(await loadTile(tile)));
  const features: Feature<Geometry, GeoJsonProperties>[] = [];
  for (const layerName of DRAWING_LAYERS) {
    const layer = vectorTile.layers[layerName];
    if (!layer) continue;
    for (let index = 0; index < layer.length; index += 1) {
      const decoded = layer
        .feature(index)
        .toGeoJSON(tile.x, tile.y, tile.z) as Feature<
        Geometry,
        GeoJsonProperties
      >;
      const mapped = mapOpenMapTilesFeature(layerName, decoded);
      features.push(...clippedFeatures(mapped, bounds));
    }
  }
  return features;
}

export async function queryOpenFreeMap(
  bounds: Bbox
): Promise<FeatureCollection> {
  const tiles = tilesForBounds(bounds);
  if (tiles.length > 16) {
    throw new Error('Der Kartenausschnitt ist für Detaildaten zu groß');
  }
  const decoded = (
    await Promise.all(tiles.map(tile => decodeTile(tile, bounds)))
  ).flat();
  const seen = new Set<string>();
  const features = decoded.filter(feature => {
    const key = `${feature.geometry.type}/${JSON.stringify(feature.properties)}/${JSON.stringify(feature.geometry)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { type: 'FeatureCollection', features };
}

export async function prefetchOpenFreeMap(
  bounds: Bbox[],
  progress?: (current: number, total: number) => void,
  signal?: AbortSignal
) {
  const unique = new Map<string, TileId>();
  for (const box of bounds) {
    for (const tile of tilesForBounds(box)) {
      unique.set(`${tile.z}/${tile.x}/${tile.y}`, tile);
    }
  }
  const queue = [...unique.values()];
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      if (signal?.aborted) throw new Error('Abgebrochen');
      const tile = queue[cursor++];
      await loadTile(tile);
      if (signal?.aborted) throw new Error('Abgebrochen');
      completed += 1;
      progress?.(completed, queue.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
}

export const OPENFREEMAP_SOURCE_ZOOM = SOURCE_ZOOM;
