// Keep this caller unchanged in the acceptance PR: its contract matters.
import { isFresh, nextIndex } from './cache.mjs';

export function selectCachedRoute(entry, now = Date.now()) {
  return isFresh(entry.savedAt, now, 60_000) ? entry.route : null;
}

export function advance(points, current) {
  if (points.length === 0) return null;
  return points[nextIndex(current, points.length)];
}
