import { distance, point } from '@turf/turf';
import type { Project, Waypoint, Entry } from './model';
import { importRn2 } from './rn2';

// Also exposes all tulips in projects imported before editable RN2 support.
export const editableWaypoints = (p: Project): Waypoint[] =>
  p.rn2Original
    ? p.rn2Original.route.waypoints
        .filter((w, i, a) => w.show || i === 0 || i === a.length - 1)
        .map(w => ({ lat: w.lat, lon: w.lon }))
    : p.waypoints;
export const samePoints = (a: Waypoint[], b: Waypoint[]) =>
  a.length === b.length &&
  a.every((p, i) => p.lat === b[i].lat && p.lon === b[i].lon);
const meters = (a: number[], b: number[]) =>
  distance(point(a), point(b), { units: 'meters' });
function positions(coords: number[][]) {
  const ds = [0];
  for (let i = 1; i < coords.length; i++)
    ds.push(ds[i - 1] + meters(coords[i - 1], coords[i]));
  return ds;
}
function sample(coords: number[][], ds: number[], at: number) {
  if (at < 0 || at > ds.at(-1)!) return null;
  let lo = 0,
    hi = ds.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (ds[m] < at) lo = m + 1;
    else hi = m;
  }
  if (!lo) return coords[0];
  const f = (at - ds[lo - 1]) / (ds[lo] - ds[lo - 1] || 1);
  return coords[lo].map(
    (v, k) => coords[lo - 1][k] + (v - coords[lo - 1][k]) * f
  );
}

// Preserve a drawing only when its location AND approach/departure still match.
// Sampling by distance also tolerates a different number of routing vertices.
export function retainedRn2Entries(
  project: Project,
  track: NonNullable<Project['track']>
): Entry[] {
  const source = project.rn2Source;
  if (!source) return [];
  const old = importRn2(JSON.stringify(source)),
    before = old.track!.features[0].geometry.coordinates;
  const after = track.features[0].geometry.coordinates,
    bd = positions(before),
    ad = positions(after);
  const retained: Entry[] = [];
  let cursor = 0;
  for (const e of old.entries) {
    const index = e.rn2WaypointIndex!,
      center = before[index];
    let best = -1,
      min = 3;
    for (let j = cursor; j < after.length; j++) {
      const d = meters(center, after[j]);
      if (d < min) {
        min = d;
        best = j;
      }
    }
    if (best < 0) continue;
    const matches = [-60, -40, -20, -5, 0, 5, 20, 40, 60].every(offset => {
      const a = sample(before, bd, bd[index] + offset),
        b = sample(after, ad, ad[best] + offset);
      return !a || !b ? a === b : meters(a, b) <= 3;
    });
    if (!matches) continue;
    cursor = best + 1;
    const p = e.turn.points[0];
    retained.push({
      ...e,
      distance: ad[best],
      turn: {
        ...e.turn,
        distanceFromStart: ad[best],
        points: [
          {
            ...p,
            longitude: after[best][0],
            latitude: after[best][1],
            totalDistance: ad[best],
          },
        ],
      },
    });
  }
  return retained;
}

export function updateLocalProject(previous: Project, body: any): Project {
  const waypoints =
    body.waypoints || body.points || editableWaypoints(previous);
  const changed =
    !samePoints(waypoints, editableWaypoints(previous)) ||
    (body.profile && body.profile !== previous.profile) ||
    (body.cached_brouterTrack_data &&
      JSON.stringify(body.cached_brouterTrack_data) !==
        JSON.stringify(previous.track));
  return {
    ...previous,
    name: body.name ?? previous.name,
    waypoints,
    profile: body.profile || previous.profile,
    track: body.cached_brouterTrack_data ?? (changed ? null : previous.track),
    entries: changed ? [] : previous.entries,
    rn2Original: changed ? undefined : previous.rn2Original,
    rn2Source:
      previous.rn2Source || (changed ? previous.rn2Original : undefined),
    revision: previous.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}
