import { point } from '@turf/helpers';
import { distance, bearing } from '@turf/turf';

/**
 * Calculate distance between two geographic points in meters (via Turf)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const start = point([lon1, lat1]);
  const end = point([lon2, lat2]);
  return distance(start, end, { units: 'meters' });
}

/**
 * Calculate bearing (0-360) between two points (via Turf)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const start = point([lon1, lat1]);
  const end = point([lon2, lat2]);
  let b = bearing(start, end);
  if (b < 0) b += 360;
  return b;
}
