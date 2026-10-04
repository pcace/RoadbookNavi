import { describe, expect, it } from 'vitest';
import { mapOpenMapTilesFeature, tilesForBounds } from './openFreeMap';

describe('OpenFreeMap roadbook data', () => {
  it('uses the maximum source zoom and covers a turn with few tiles', () => {
    const tiles = tilesForBounds([8.8039, 53.074, 8.8101, 53.0778]);
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(4);
    expect(tiles.every(tile => tile.z === 14)).toBe(true);
  });

  it('maps OpenMapTiles road and rail attributes to the drawing contract', () => {
    const road = mapOpenMapTilesFeature('transportation', {
      type: 'Feature',
      properties: {
        class: 'minor',
        subclass: 'residential',
        brunnel: 'bridge',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [8, 53],
          [8.1, 53.1],
        ],
      },
    });
    expect(road.properties).toMatchObject({
      highway: 'residential',
      bridge: 'yes',
    });
    const rail = mapOpenMapTilesFeature('transportation', {
      type: 'Feature',
      properties: { class: 'rail', subclass: 'rail' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [8, 53],
          [8.1, 53.1],
        ],
      },
    });
    expect(rail.properties).toMatchObject({ railway: 'rail' });
    expect(rail.properties).not.toHaveProperty('highway');
  });
});
