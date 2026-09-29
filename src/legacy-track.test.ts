import { it, expect } from 'vitest';
import { joinLegacyTrack } from './legacy-track';
import type { Project } from './model';
it('preserves all old preview segments for GPX/PDF/RN2 without inventing turn instructions', () => {
  const track = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { length_m: 71, surface: 'gravel' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [10, 50],
            [10.001, 50],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { length_m: 72, surface: 'asphalt' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [10.001, 50],
            [10.002, 50],
          ],
        },
      },
    ],
  } as unknown as Project['track'];
  const merged = joinLegacyTrack(track)!;
  expect(merged.features[0].geometry.coordinates).toHaveLength(3);
  expect(merged.features[0].properties['track-length']).toBe(143);
  expect(merged.features[0].properties.messages).toBeUndefined();
  expect(track!.features).toHaveLength(2);
});
