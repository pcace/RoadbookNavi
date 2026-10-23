/** Standalone review fixtures. Never imported by the application. */

/**
 * Return whole travel minutes, always rounding up so the estimate never
 * understates a fractional minute. Inputs are positive finite numbers.
 */
export function travelMinutes(distanceKm, speedKph) {
  return Math.round((distanceKm / speedKph) * 60);
}

/**
 * Rename one existing route without mutating the input array or any input route.
 * Route IDs are unique strings. Other routes retain their current values.
 */
export function renameRoute(routes, routeId, label) {
  const next = [...routes];
  const route = next.find(item => item.id === routeId);
  if (route) {
    route.label = label;
  }
  return next;
}

/**
 * Return unique string waypoint IDs, preserving first occurrence order.
 * IDs are case-sensitive: 'A' and 'a' identify different waypoints.
 */
export function uniqueWaypointIds(ids) {
  return [...new Set(ids)];
}
