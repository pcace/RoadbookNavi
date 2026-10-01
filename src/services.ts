import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectRepository,
  RoutingEngine,
  OsmFeatureProvider,
  Geocoder,
  Region,
} from './model';
export const repository: ProjectRepository = {
  list: () => invoke('list_projects'),
  save: project => invoke('save_project', { project }),
  remove: id => invoke('delete_project', { id }),
};
export const routing: RoutingEngine = {
  route: (points, profile, polygons) =>
    invoke('calculate_route', {
      profile,
      lonlats: points.map(p => `${p.lon},${p.lat}`).join('|'),
      polygons,
    }),
};
export const osm: OsmFeatureProvider = {
  query: (bbox, purpose) => invoke('query_features', { bbox, purpose }),
};
export const geocoder: Geocoder = {
  search: query => invoke('search_places', { query }),
};
export const loadLibrary = () =>
  invoke<{ regions: Region[]; profiles: string[] }>('library');
export const deviceStorage = () =>
  invoke<{ available: number; total: number }>('storage_usage');
