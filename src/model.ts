import type { FeatureCollection } from 'geojson';
import type { BRouterGeoJSON, Turn } from './core/types';
export type Bbox = [number, number, number, number];
export type Waypoint = { lat: number; lon: number };
export type Entry = {
  turn: Turn;
  distance: number;
  svg: string;
  note: string;
  rn2Elements?: Record<string, any>[];
  rn2GeometryVersion?: number;
  rn2WaypointIndex?: number;
  rn2NotesSvg?: string;
};
export type Project = {
  schemaVersion: 1;
  legacyEntriesCheckedAt?: string;
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  waypoints: Waypoint[];
  profile: string;
  track: BRouterGeoJSON | null;
  entries: Entry[];
  rn2Original?: import('./core/rn2/document').Rn2Document;
  rn2Source?: import('./core/rn2/document').Rn2Document;
};
export interface ProjectRepository {
  list(): Promise<Project[]>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface RoutingEngine {
  route(
    points: Waypoint[],
    profile: string,
    polygons: string
  ): Promise<BRouterGeoJSON>;
}
export interface OsmFeatureProvider {
  query(
    bbox: Bbox,
    purpose: 'detail' | 'map' | 'map-overview'
  ): Promise<FeatureCollection>;
}
export const newProject = (profile = 'trekking'): Project => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  name: 'Neues Roadbook',
  revision: 0,
  updatedAt: new Date().toISOString(),
  waypoints: [],
  profile,
  track: null,
  entries: [],
});

export function validPoint(p: unknown): p is Waypoint {
  if (!p || typeof p !== 'object') return false;
  const { lat, lon } = p as Waypoint;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
export function validateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object')
    throw new Error('Ungültige Projektdatei');
  const p = raw as Project;
  if (
    p.schemaVersion !== 1 ||
    typeof p.id !== 'string' ||
    !/^[\w-]{1,100}$/.test(p.id) ||
    typeof p.name !== 'string' ||
    p.name.length > 300 ||
    !Array.isArray(p.waypoints) ||
    p.waypoints.length > 10000 ||
    !p.waypoints.every(validPoint) ||
    typeof p.profile !== 'string' ||
    !/^[\w-]{1,100}$/.test(p.profile)
  )
    throw new Error('Projektformat oder Wegpunkte ungültig');
  if (p.track) {
    const f = p.track.features?.[0];
    if (
      p.track.type !== 'FeatureCollection' ||
      f?.geometry?.type !== 'LineString' ||
      !Array.isArray(f.geometry.coordinates) ||
      f.geometry.coordinates.length < 2 ||
      f.geometry.coordinates.length > 1000000 ||
      !f.geometry.coordinates.every(
        c => Array.isArray(c) && validPoint({ lon: c[0], lat: c[1] })
      )
    )
      throw new Error('Routendaten ungültig');
  }
  if (!Array.isArray(p.entries) || p.entries.length > 20000)
    throw new Error('Roadbook-Einträge ungültig');
  for (const e of p.entries)
    if (
      !Number.isFinite(e.distance) ||
      e.distance < 0 ||
      typeof e.svg !== 'string' ||
      e.svg.length > 2000000 ||
      typeof e.turn?.instruction !== 'string' ||
      !validPoint({
        lat: e.turn?.points?.[0]?.latitude,
        lon: e.turn?.points?.[0]?.longitude,
      })
    )
      throw new Error('Roadbook-Eintrag ungültig');
  return {
    ...p,
    revision: Number.isInteger(p.revision) ? p.revision : 0,
    entries: p.entries.map(e => ({
      ...e,
      note: typeof e.note === 'string' ? e.note : '',
    })),
  };
}
