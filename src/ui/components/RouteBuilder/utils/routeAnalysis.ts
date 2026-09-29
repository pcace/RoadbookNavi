import { FeatureCollection, LineString, Point } from 'geojson';
import { length } from '@turf/turf';
import {
  getSurfaceLabel,
  normalizeSurfaceKey,
  getSurfaceInfo,
} from './surfaces';

export type SurfaceItem = {
  key: string;
  display: string;
  length_m: number;
  color: string;
};
export type RouteStats = {
  lengthText: string;
  turnPoints: number;
  surfaces: SurfaceItem[];
  formatMeters: (m: number) => string;
  onRoadPct: number;
  offRoadPct: number;
};

// Deterministic color from surface key (HSL hashing)
const colorFromKey = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 60%, 45%)`;
};

// Distance formatter helper
export const formatMeters = (m: number) => {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 100) return `${Math.round(m / 10) * 10} m`;
  return `${Math.round(m)} m`;
};

export function computeRouteAnalysis(
  routeData: FeatureCollection<LineString> | null,
  turnPoints?: FeatureCollection<Point> | null
): { routeStats: RouteStats | null; routeLineColor: any } {
  if (!routeData || !routeData.features || routeData.features.length === 0) {
    return { routeStats: null, routeLineColor: 'rgba(124,52,2,1)' };
  }

  try {
    let totalMeters = 0;
    let pavedMeters = 0;
    let unpavedMeters = 0;
    const surfaceMeters: Record<string, number> = {};

    for (const f of routeData.features as any[]) {
      if (!f || f.geometry?.type !== 'LineString') continue;
      const mProp = (f.properties?.length_m as number) ?? null;
      const segMeters =
        mProp != null && !Number.isNaN(mProp)
          ? mProp
          : length(f as any, { units: 'kilometers' }) * 1000;
      totalMeters += segMeters;

      const surfRaw = (f.properties?.surface as string) || 'unknown';
      const surf = normalizeSurfaceKey(surfRaw);
      surfaceMeters[surf] = (surfaceMeters[surf] || 0) + segMeters;

      // simple on/off classification based on surface group
      const info = getSurfaceInfo(surf);
      if (info.group === 'paved') pavedMeters += segMeters;
      else if (info.group === 'unpaved') unpavedMeters += segMeters;
    }

    const surfaces: SurfaceItem[] = Object.entries(surfaceMeters)
      .map(([key, len]) => ({
        key,
        display: getSurfaceLabel(key, 'de'),
        length_m: len as number,
        color: colorFromKey(key),
      }))
      .sort((a, b) => b.length_m - a.length_m);

    const turnPointCount = turnPoints?.features?.length || 0;

    const onPct =
      totalMeters > 0 ? Math.round((pavedMeters / totalMeters) * 100) : 0;
    const offPct =
      totalMeters > 0 ? Math.round((unpavedMeters / totalMeters) * 100) : 0;

    const routeStats: RouteStats = {
      lengthText: (totalMeters / 1000).toFixed(1),
      turnPoints: turnPointCount,
      surfaces,
      formatMeters,
      onRoadPct: onPct,
      offRoadPct: offPct,
    };

    // Build data-driven line color expression by surface
    let routeLineColor: any = 'rgba(124,52,2,1)';
    if (surfaces.length > 0) {
      const expr: any[] = [
        'match',
        ['coalesce', ['get', 'surface_norm'], ['get', 'surface'], 'unknown'],
      ];
      for (const s of surfaces) {
        expr.push(s.key);
        expr.push(s.color);
      }
      expr.push('rgba(124,52,2,1)'); // fallback color
      routeLineColor = expr;
    }

    return { routeStats, routeLineColor };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error analyzing route data:', error);
    return { routeStats: null, routeLineColor: 'rgba(124,52,2,1)' };
  }
}
