import type { Project } from './model';
/** Old web routes stored segmented map previews. Keep every segment for exports;
 * an absent messages array still distinguishes them from complete engine output. */
export function joinLegacyTrack(track: Project['track']): Project['track'] {
  if (!track || track.features.length <= 1) return track;
  const coordinates: number[][] = [];
  let length = 0;
  for (const feature of track.features) {
    if (feature.geometry?.type !== 'LineString')
      throw new Error('Ungültige gespeicherte Strecke');
    for (const c of feature.geometry.coordinates) {
      const last = coordinates.at(-1);
      if (!last || last[0] !== c[0] || last[1] !== c[1]) coordinates.push(c);
    }
    length +=
      Number((feature.properties as Record<string, unknown>)?.length_m) || 0;
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { 'track-length': length, surfaceSegments: track.features },
      },
    ],
  } as unknown as NonNullable<Project['track']>;
}
