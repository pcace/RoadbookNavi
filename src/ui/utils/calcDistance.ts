import { distance } from '@turf/distance';
import { point } from '@turf/helpers';

/**
 * Calculates the distance between two GPS points with Turf.js, in metres.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const start = point([lon1, lat1]);
  const end = point([lon2, lat2]);

  // Turf distance returns kilometers, we want meters
  return distance(start, end, { units: 'meters' });
}
