/** Standalone review fixtures. Never imported by the application. */

/**
 * Return whole travel minutes, always rounding up so the estimate never
 * understates a fractional minute. Inputs are positive finite numbers.
 */
export function travelMinutes(distanceKm, speedKph) {
  return Math.ceil((distanceKm / speedKph) * 60);
}

/**
 * Rename one existing route without mutating the input array or any input route.
 * Route IDs are unique strings. Other routes retain their current values.
 */
export function renameRoute(routes, routeId, label) {
  return routes.map(route =>
    route.id === routeId ? { ...route, label } : route
  );
}

/**
 * Return unique string waypoint IDs, preserving first occurrence order.
 * IDs are case-sensitive: 'A' and 'a' identify different waypoints.
 */
export function uniqueWaypointIds(ids) {
  return [...new Set(ids)];
}

/** Return the UTC calendar date (YYYY-MM-DD) for a valid ISO timestamp ending in Z. */
export function utcRouteDate(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return [year, month, day].join('-');
}
