import type { RefObject } from 'react';
import { length, lineString, nearestPointOnLine, point } from '@turf/turf';
import type { FeatureCollection, GeoJsonProperties, LineString } from 'geojson';
import type { RoutePoint } from '../types';

export type RouteBuilderMapView = {
  latitude: number;
  longitude: number;
  zoom: number;
};

export const DEFAULT_ROUTE_BUILDER_VIEW: RouteBuilderMapView = {
  latitude: 51.1657,
  longitude: 10.4515,
  zoom: 6,
};

export const ROUTE_POINT_PIXEL_TOLERANCE = 20;
export const DISTANCE_WARNING_TIMEOUT_MS = 3000;

export const getInitialRouteBuilderView = (
  storedMapView: RouteBuilderMapView | null,
  searchParams: URLSearchParams
): RouteBuilderMapView => {
  if (storedMapView) {
    return storedMapView;
  }

  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const zoom = searchParams.get('zoom');

  if (lat && lng && zoom) {
    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      zoom: parseFloat(zoom),
    };
  }

  return DEFAULT_ROUTE_BUILDER_VIEW;
};

export const buildRoutePointsCoordsString = (routePoints: RoutePoint[]) =>
  routePoints
    .map(point => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`)
    .join('|');

export const createStraightLineRoute = (
  points: RoutePoint[]
): FeatureCollection<LineString, GeoJsonProperties> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: points.map(point => [point.lon, point.lat]),
      },
    },
  ],
});

export const calculateRouteLength = (
  routeData: FeatureCollection<LineString, GeoJsonProperties> | null
): number => {
  if (!routeData?.features?.length) {
    return 0;
  }

  const feature = routeData.features[0];
  if (!feature?.geometry) {
    return 0;
  }

  try {
    return length(feature, { units: 'kilometers' });
  } catch (error) {
    console.error('Error calculating route length:', error);
    return 0;
  }
};

export const extractLocationName = (
  displayName: string | undefined
): string | null => {
  if (!displayName) {
    return null;
  }

  const parts = displayName.split(',').map(part => part.trim());

  for (const part of parts) {
    if (/\d/.test(part) || /straße|str\.|street|road|way|avenue/i.test(part)) {
      continue;
    }
    return part;
  }

  return parts[0] || null;
};

const getMapInstance = (mapRef: RefObject<any>) => mapRef.current?.getMap?.();

const getPixelDistance = (
  map: any,
  from: [number, number],
  to: [number, number]
) => {
  const fromPixel = map.project(from);
  const toPixel = map.project(to);

  return Math.sqrt(
    Math.pow(fromPixel.x - toPixel.x, 2) + Math.pow(fromPixel.y - toPixel.y, 2)
  );
};

export const isClickNearExistingPoint = ({
  lng,
  lat,
  routePoints,
  mapRef,
  pixelTolerance = ROUTE_POINT_PIXEL_TOLERANCE,
}: {
  lng: number;
  lat: number;
  routePoints: RoutePoint[];
  mapRef: RefObject<any>;
  pixelTolerance?: number;
}) => {
  const map = getMapInstance(mapRef);
  if (!map || routePoints.length === 0) {
    return false;
  }

  return routePoints.some(existingPoint => {
    const distance = getPixelDistance(
      map,
      [lng, lat],
      [existingPoint.lon, existingPoint.lat]
    );
    return distance < pixelTolerance;
  });
};

export const findRouteInsertIndex = ({
  lng,
  lat,
  routePoints,
  routeData,
  mapRef,
  pixelTolerance = ROUTE_POINT_PIXEL_TOLERANCE,
}: {
  lng: number;
  lat: number;
  routePoints: RoutePoint[];
  routeData: FeatureCollection<LineString, GeoJsonProperties> | null;
  mapRef: RefObject<any>;
  pixelTolerance?: number;
}) => {
  const defaultInsertIndex = routePoints.length;
  const routeLines = routeData?.features?.filter(feature => feature?.geometry);
  const map = getMapInstance(mapRef);

  if (!routeLines?.length || routePoints.length < 2 || !map) {
    return defaultInsertIndex;
  }

  try {
    const clickedPoint = point([lng, lat]);
    let minRoutePixelDistance = Infinity;

    for (const routeLine of routeLines) {
      const nearest = nearestPointOnLine(routeLine, clickedPoint, {
        units: 'meters',
      });
      const nearestCoords = nearest.geometry.coordinates as [number, number];
      const pixelDistance = getPixelDistance(map, [lng, lat], nearestCoords);

      if (pixelDistance < minRoutePixelDistance) {
        minRoutePixelDistance = pixelDistance;
      }
    }

    if (minRoutePixelDistance >= pixelTolerance) {
      return defaultInsertIndex;
    }

    let minSegmentDistance = Infinity;
    let bestInsertIndex = defaultInsertIndex;

    for (let index = 0; index < routePoints.length - 1; index += 1) {
      const segmentStart = routePoints[index];
      const segmentEnd = routePoints[index + 1];
      const segment = lineString([
        [segmentStart.lon, segmentStart.lat],
        [segmentEnd.lon, segmentEnd.lat],
      ]);
      const nearestOnSegment = nearestPointOnLine(segment, clickedPoint, {
        units: 'meters',
      });
      const distance = nearestOnSegment.properties.dist;

      if (distance !== undefined && distance < minSegmentDistance) {
        minSegmentDistance = distance;
        bestInsertIndex = index + 1;
      }
    }

    return bestInsertIndex;
  } catch (error) {
    console.error('Error finding insert position:', error);
    return defaultInsertIndex;
  }
};
