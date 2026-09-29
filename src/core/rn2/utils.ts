import { Point } from './types';

/**
 * Samples handles evenly distributed along a path.
 * @param coords - The coordinates to sample from
 * @param maxHandles - Maximum number of handles to return
 * @returns Array of sampled points
 */
export const sampleHandles = (coords: Point[], maxHandles: number): Point[] => {
  if (!coords.length || maxHandles <= 0) return [];
  if (coords.length <= maxHandles) return coords;

  const handles: Point[] = [];
  for (let i = 1; i <= maxHandles; i++) {
    const t = i / (maxHandles + 1);
    const idx = Math.max(
      0,
      Math.min(coords.length - 1, Math.round(t * (coords.length - 1)))
    );
    handles.push(coords[idx]);
  }
  return handles;
};

/**
 * Filters out handles that are too close together or too close to the end point.
 * @param handles - Array of handle points to filter
 * @param endPoint - The end point to check distance against
 * @param minDistance - Minimum distance threshold (default: 4.0)
 * @returns Filtered array of handles
 */
export const filterCloseTogether = (
  handles: Point[],
  endPoint: Point,
  minDistance: number = 4.0
): Point[] => {
  if (handles.length === 0) return handles;

  const filtered: Point[] = [];
  let lastPoint = { x: 0, y: 0 }; // Start is always at origin

  for (const handle of handles) {
    const dist = Math.sqrt(
      (handle.x - lastPoint.x) ** 2 + (handle.y - lastPoint.y) ** 2
    );

    if (dist >= minDistance) {
      filtered.push(handle);
      lastPoint = handle;
    }
  }

  // Check if last handle is too close to end point
  if (filtered.length > 0) {
    const lastHandle = filtered[filtered.length - 1];
    const dist = Math.sqrt(
      (endPoint.x - lastHandle.x) ** 2 + (endPoint.y - lastHandle.y) ** 2
    );

    if (dist < minDistance) {
      filtered.pop(); // Remove last handle if too close to end
    }
  }

  return filtered;
};

/**
 * Converts terrain type to RN2 road type ID.
 */
export const terrainToTypeId = (terrain?: string): number => {
  switch (terrain) {
    case 'path':
      return 15;
    case 'track':
      return 16;
    case 'residential':
      return 4;
    case 'tertiary':
      return 17;
    case 'secondary':
      return 18;
    case 'highway':
      return 12;
    default:
      return 4; // default road type
  }
};

/**
 * Sorts coordinates by distance from center (0,0).
 * Reverses the array if the first point is closer than the last.
 */
export const sortCoordsByCenter = (coords: Point[] = []) => {
  if (!coords.length) return coords;
  const dist = (p: Point) => p.x * p.x + p.y * p.y;
  const firstDist = dist(coords[0]);
  const lastDist = dist(coords[coords.length - 1]);
  return lastDist >= firstDist ? coords : [...coords].reverse();
};

/**
 * Picks the index of the point closest to origin (0,0).
 */
export const pickPivotIndexClosestToOrigin = (coords: Point[]): number => {
  if (!coords.length) return 0;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i++) {
    const p = coords[i];
    const d = p.x * p.x + p.y * p.y;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
};

/**
 * Formats a date into a filename-safe timestamp string.
 */
export const formatTimestampForFilename = (date: Date = new Date()): string => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mm = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
};
