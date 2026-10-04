import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectRepository,
  RoutingEngine,
  OsmFeatureProvider,
} from './model';
import { queryOpenFreeMap } from './openFreeMap';
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
  query: bbox => queryOpenFreeMap(bbox),
};
export const loadLibrary = () => invoke<{ profiles: string[] }>('library');
export const deviceStorage = () =>
  invoke<{ available: number; total: number }>('storage_usage');
export const geographicCacheUsage = () =>
  invoke<{ mapTiles: number; routing: number }>('geographic_cache_usage');
export const clearGeographicCache = (kind: 'mapTiles' | 'routing') =>
  invoke<void>('clear_geographic_cache', { kind });
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  updateAvailable: boolean;
}
export const checkForUpdate = () => invoke<UpdateStatus>('check_for_update');
