// Isolated review fixtures; not imported by application code.

// Convert a finite non-negative duration in minutes to seconds.
export function minutesToSeconds(minutes) {
  return minutes * 60;
}

// Empty names are deliberate; only null/undefined use the fallback.
export function routeLabel(route) {
  return route.name ?? 'Unnamed route';
}

// Convert finite non-negative metres to kilometres without rounding.
export function metresToKilometres(metres) {
  return metres / 1000;
}
