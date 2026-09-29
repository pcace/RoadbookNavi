const ROADBOOK_PATH = '/app/roadbook';
const ROUTE_PLANNING_PATH = '/app/route-planning';

const UUID_AT_END_REGEX =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export interface ParsedRoadbookRouteRef {
  routeId: string | null;
  routeSlug: string | null;
  routeName: string | null;
}

export const slugifyRoadbookRouteName = (routeName: string): string => {
  const normalized = routeName
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'route';
};

export const buildRoadbookPath = (
  routeId?: string | null,
  _routeName?: string | null
): string => {
  if (!routeId) {
    return ROADBOOK_PATH;
  }

  return `${ROADBOOK_PATH}/${routeId}`;
};

export const buildRoutePlanningPath = (routeId?: string | null): string => {
  if (!routeId) {
    return ROUTE_PLANNING_PATH;
  }

  return `${ROUTE_PLANNING_PATH}/${routeId}/edit`;
};

export const getRoutePlanningView = (
  waypoints: Array<{ lat: number; lon: number }>
): { latitude: number; longitude: number; zoom: number } | null => {
  if (!waypoints.length) {
    return null;
  }

  const latitudes = waypoints.map(point => point.lat);
  const longitudes = waypoints.map(point => point.lon);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    zoom: waypoints.length === 1 ? 13 : 10,
  };
};

export const parseRoadbookRouteRef = (
  routeRef?: string | null
): ParsedRoadbookRouteRef => {
  if (!routeRef) {
    return {
      routeId: null,
      routeSlug: null,
      routeName: null,
    };
  }

  const normalizedRef = decodeURIComponent(routeRef).trim();
  const match = normalizedRef.match(UUID_AT_END_REGEX);

  if (!match) {
    return {
      routeId: null,
      routeSlug: normalizedRef || null,
      routeName: normalizedRef
        ? normalizedRef.replace(/-/g, ' ').trim() || null
        : null,
    };
  }

  const routeId = match[1];
  const rawSlug = normalizedRef.slice(0, -routeId.length).replace(/-+$/g, '');

  return {
    routeId,
    routeSlug: rawSlug || null,
    routeName: rawSlug ? rawSlug.replace(/-/g, ' ').trim() || null : null,
  };
};

export const getAppSectionFromPathname = (pathname: string): string => {
  const section = pathname.split('/app/')[1];
  return section?.split('/')[0] || 'roadbook';
};
