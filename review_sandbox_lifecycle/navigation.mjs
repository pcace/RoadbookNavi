// Isolated review fixtures: not imported or executed by RoadbookNavi.

// Return the next existing waypoint index, or null at the end of the list.
// Empty lists have no next waypoint. currentIndex is a valid index or -1.
export function nextWaypointIndex(currentIndex, waypoints) {
  const next = currentIndex + 1;
  return next <= waypoints.length ? next : null;
}

// All timestamps are milliseconds; ttlSeconds is a finite non-negative duration.
// A cache entry expires when its age reaches the TTL, including the exact boundary.
export function cacheExpired(savedAtMs, nowMs, ttlSeconds) {
  return nowMs - savedAtMs >= ttlSeconds;
}

// The waypoint at index zero is valid. Missing IDs return null.
export function waypointById(waypoints, id) {
  return waypoints.find((waypoint) => waypoint.id === id) ?? null;
}
