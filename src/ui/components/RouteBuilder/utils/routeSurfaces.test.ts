import { it, expect } from 'vitest';
import { routeSurfacePreview, surfaceTags } from './routeSurfaces';
import type { FeatureCollection, LineString } from 'geojson';
it('uses explicit surface before inferred tracktype/highway, keeps unknown unknown', () => {
  expect(surfaceTags('surface=asphalt tracktype=grade5').surface).toBe(
    'asphalt'
  );
  expect(surfaceTags('tracktype=grade2')).toMatchObject({
    surface: 'gravel',
    surface_source: 'tracktype',
  });
  expect(surfaceTags('highway=secondary').surface).toBe('paved');
  expect(surfaceTags('').surface).toBe('unknown');
});
it('splits raw BRouter messages for analysis without altering the saved geometry', () => {
  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [10, 50],
            [10.001, 50],
            [10.002, 50],
          ],
        },
        properties: {
          messages: [
            ['Distance', 'WayTags'],
            ['71', 'surface=asphalt'],
            ['72', 'surface=gravel'],
          ],
        },
      },
    ],
  };
  const result = routeSurfacePreview(data);
  expect(result.features.map(f => f.properties?.surface)).toEqual([
    'asphalt',
    'gravel',
  ]);
  expect(result.features[0].geometry.coordinates.at(-1)).toEqual(
    result.features[1].geometry.coordinates[0]
  );
  expect(result.features[1].geometry.coordinates.at(-1)).toEqual([10.002, 50]);
  expect(data.features).toHaveLength(1);
});

import { computeRouteAnalysis } from './routeAnalysis';
it('does not classify missing surface data as offroad', () => {
  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [10, 50],
            [10.01, 50],
          ],
        },
        properties: { length_m: 1000, surface: 'unknown' },
      },
    ],
  };
  const stats = computeRouteAnalysis(data).routeStats!;
  expect(stats.onRoadPct).toBe(0);
  expect(stats.offRoadPct).toBe(0);
});
