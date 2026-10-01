import { describe, it, expect } from 'vitest';
import { newProject, validateProject, validPoint } from './model';
import { serializePolygons } from './geometry';
import { parseRoute } from './core/routeParser';
import { detectTurns } from './core/turnDetection';
import { getMapStyleSpec } from './ui/components/RouteBuilder/mapStyles';
import { readFileSync } from 'node:fs';

describe('offline projects', () => {
  it('round-trips editable local projects', () => {
    const p = {
      ...newProject(),
      waypoints: [
        { lat: 47, lon: 9 },
        { lat: 48, lon: 10 },
      ],
    };
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('rejects traversal, invalid coordinates and malformed imported tracks', () => {
    expect(() =>
      validateProject({ ...newProject(), id: '../escape' })
    ).toThrow();
    expect(() =>
      validateProject({
        ...newProject(),
        waypoints: [{ lat: Infinity, lon: 1 }],
      })
    ).toThrow();
    expect(() =>
      validateProject({ ...newProject(), track: { features: [] } })
    ).toThrow();
    expect(validPoint({ lat: 91, lon: 0 })).toBe(false);
  });
});
describe('coverage and routing', () => {
  it('serializes separate no-go polygons for BRouter', () => {
    expect(
      serializePolygons({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      })
    ).toBe(
      '0.000000,0.000000,1.000000,0.000000,1.000000,1.000000,0.000000,0.000000'
    );
  });
  it('uses the existing BRouter fixture for offline turn detection', () => {
    const track = JSON.parse(
      readFileSync(new URL('./fixtures/route2.json', import.meta.url), 'utf8')
    );
    const points = parseRoute(track);
    const turns = detectTurns(points);
    expect(points.length).toBeGreaterThan(2);
    expect(turns.length).toBeGreaterThan(1);
    expect(turns.every(t => Number.isFinite(t.distanceFromStart))).toBe(true);
  });
  it('accepts a straight BRouter route without intermediate voice hints', () => {
    const track = JSON.parse(
      readFileSync(new URL('./fixtures/route2.json', import.meta.url), 'utf8')
    );
    track.features[0].properties.voicehints = [];
    expect(parseRoute(track)).toHaveLength(2);
  });
});
describe('map sources', () => {
  it('uses OpenFreeMap without the volunteer OSM raster servers', () => {
    const style = JSON.stringify(getMapStyleSpec());
    expect(style).toContain('https://tiles.openfreemap.org/planet');
    expect(style).not.toContain('local-osm');
    expect(style).not.toContain('tile.openstreetmap.org');
  });
});
