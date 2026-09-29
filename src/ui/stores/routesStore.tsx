import { create } from 'zustand';
import {
  createLocalProject,
  deleteLocalProject,
  listLocalProjects,
  updateLocalProjectSummary,
} from '../services/localProjects';
import type { FeatureCollection, LineString } from 'geojson';
import { offlineCache } from '../utils/offlineCache';

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface UserRoute {
  id: string;
  name: string;
  waypoints: RoutePoint[];
  profile: string;
  cached_brouterTrack_data?: FeatureCollection<LineString>;
  total_turns?: number;
  distance_m?: number | null;
  created_at: string;
  updated_at: string;
}

interface RoutesStore {
  routes: UserRoute[];
  isLoading: boolean;
  error: string | null;

  // Local project actions
  loadRoutes: () => Promise<void>;
  saveRoute: (
    route: Omit<UserRoute, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<UserRoute>;
  updateRoute: (id: string, route: Partial<UserRoute>) => Promise<UserRoute>;
  deleteRoute: (id: string) => Promise<void>;
}

const normalizeRoute = (route: any, previousRoute?: UserRoute): UserRoute => {
  const waypoints = Array.isArray(route?.waypoints)
    ? route.waypoints
    : Array.isArray(route?.points)
      ? route.points
      : previousRoute?.waypoints || [];
  return {
    ...previousRoute,
    ...route,
    waypoints,
  };
};

export const useRoutesStore = create<RoutesStore>()(set => ({
  routes: [],
  isLoading: false,
  error: null,

  loadRoutes: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await listLocalProjects();
      set({
        routes: Array.isArray(data)
          ? data.map(route => normalizeRoute(route))
          : [],
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load routes',
        isLoading: false,
      });
    }
  },

  saveRoute: async route => {
    set({ isLoading: true, error: null });
    try {
      const data = await createLocalProject(route);
      const normalizedRoute = normalizeRoute(data);
      set(state => ({
        routes: [normalizedRoute, ...state.routes],
        isLoading: false,
      }));
      return normalizedRoute;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save route',
        isLoading: false,
      });
      throw error;
    }
  },

  updateRoute: async (id, route) => {
    set({ isLoading: true, error: null });
    try {
      const data = await updateLocalProjectSummary(id, route);
      const previousRoute = useRoutesStore
        .getState()
        .routes.find(r => r.id === id);
      const normalizedRoute = normalizeRoute(data, previousRoute);
      set(state => ({
        routes: state.routes.map(r => (r.id === id ? normalizedRoute : r)),
        isLoading: false,
      }));
      try {
        await offlineCache.deleteRoadbook(id);
      } catch (cacheError) {
        console.warn(`Failed to delete cached roadbook ${id}:`, cacheError);
      }
      return normalizedRoute;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to update route',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteRoute: async id => {
    set({ isLoading: true, error: null });
    try {
      await deleteLocalProject(id);
      set(state => ({
        routes: state.routes.filter(r => r.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to delete route',
        isLoading: false,
      });
      throw error;
    }
  },
}));
