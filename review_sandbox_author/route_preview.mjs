// Isolated contract examples; intentionally not imported by the application.

// A route can have multiple pending routing requests, including for the same ID.
// Keep state untouched unless BOTH routeId and requestId match the active request.
export function applyRoutingResponse(state, response) {
  if (response.routeId !== state.routeId || response.requestId !== state.requestId) return state;
  return { ...state, geometry: response.geometry };
}

// The route planner stores minutes; GPS telemetry provides elapsed seconds.
// Return whole remaining minutes, rounded up and never below zero.
export function remainingMinutes(plannedMinutes, elapsedSeconds) {
  return Math.max(0, Math.ceil(plannedMinutes - elapsedSeconds));
}

// Coordinates on the equator or prime meridian are valid, including [0, 0].
// Malformed/out-of-range coordinates are rejected; no truthiness check is used.
export function validCoordinate(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}
