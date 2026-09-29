import { FeatureCollection, LineString } from 'geojson';
import { simplify } from '@turf/turf';

export interface GPXPoint {
  lat: number;
  lon: number;
  ele?: number;
}

/**
 * Parse GPX file content and extract track points
 */
export function parseGPX(gpxContent: string): GPXPoint[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

  // Check for parsing errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX file format');
  }

  const points: GPXPoint[] = [];

  // Extract track points from <trkpt> elements
  const trkpts = xmlDoc.querySelectorAll('trkpt');

  if (trkpts.length === 0) {
    // Try route points as fallback
    const rtepts = xmlDoc.querySelectorAll('rtept');
    if (rtepts.length === 0) {
      throw new Error('No track points or route points found in GPX file');
    }

    rtepts.forEach(rtept => {
      const lat = parseFloat(rtept.getAttribute('lat') || '0');
      const lon = parseFloat(rtept.getAttribute('lon') || '0');
      const eleElement = rtept.querySelector('ele');
      const ele = eleElement
        ? parseFloat(eleElement.textContent || '0')
        : undefined;

      if (lat && lon) {
        points.push({ lat, lon, ele });
      }
    });
  } else {
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '0');
      const lon = parseFloat(trkpt.getAttribute('lon') || '0');
      const eleElement = trkpt.querySelector('ele');
      const ele = eleElement
        ? parseFloat(eleElement.textContent || '0')
        : undefined;

      if (lat && lon) {
        points.push({ lat, lon, ele });
      }
    });
  }

  return points;
}

/**
 * Convert GPX points to GeoJSON LineString FeatureCollection
 */
export function gpxPointsToGeoJSON(
  points: GPXPoint[]
): FeatureCollection<LineString> {
  const coordinates = points.map(p => [p.lon, p.lat]);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  };
}

/**
 * Simplify a GPX line using Turf.js simplify
 * @param geojson - GeoJSON FeatureCollection with LineString
 * @param tolerance - Simplification tolerance (higher = more simplified)
 * @param highQuality - Use high quality simplification (slower but better)
 */
export function simplifyGPXLine(
  geojson: FeatureCollection<LineString>,
  tolerance: number = 0.0001,
  highQuality: boolean = true
): FeatureCollection<LineString> {
  const feature = geojson.features[0];
  if (!feature) {
    return geojson;
  }

  const simplified = simplify(feature, {
    tolerance,
    highQuality,
  });

  return {
    type: 'FeatureCollection',
    features: [simplified],
  };
}

/**
 * Extract waypoints from simplified GeoJSON for routing
 * @param geojson - Simplified GeoJSON FeatureCollection
 * @param maxPoints - Maximum number of points to extract (default: 200)
 */
export function extractWaypointsForRouting(
  geojson: FeatureCollection<LineString>,
  maxPoints: number = 200
): { lat: number; lon: number }[] {
  const feature = geojson.features[0];
  if (!feature || !feature.geometry.coordinates) {
    return [];
  }

  const coordinates = feature.geometry.coordinates;

  // If we have fewer points than max, use all
  if (coordinates.length <= maxPoints) {
    return coordinates.map(coord => ({
      lon: coord[0],
      lat: coord[1],
    }));
  }

  // Otherwise, sample evenly across the route
  const step = Math.floor(coordinates.length / maxPoints);
  const waypoints: { lat: number; lon: number }[] = [];

  for (let i = 0; i < coordinates.length; i += step) {
    const coord = coordinates[i];
    waypoints.push({
      lon: coord[0],
      lat: coord[1],
    });
  }

  // Always add the last point
  const lastCoord = coordinates[coordinates.length - 1];
  const lastWaypoint = waypoints[waypoints.length - 1];
  if (
    !lastWaypoint ||
    lastWaypoint.lon !== lastCoord[0] ||
    lastWaypoint.lat !== lastCoord[1]
  ) {
    waypoints.push({
      lon: lastCoord[0],
      lat: lastCoord[1],
    });
  }

  return waypoints;
}

/**
 * Process a GPX file: parse, convert to GeoJSON, simplify, and extract waypoints
 */
export async function processGPXFile(
  file: File,
  options?: {
    simplifyTolerance?: number;
    maxWaypoints?: number;
  }
): Promise<{
  originalGeoJSON: FeatureCollection<LineString>;
  simplifiedGeoJSON: FeatureCollection<LineString>;
  waypoints: { lat: number; lon: number }[];
  gpxPoints: GPXPoint[];
}> {
  const content = await file.text();
  const gpxPoints = parseGPX(content);

  if (gpxPoints.length === 0) {
    throw new Error('No points found in GPX file');
  }

  const originalGeoJSON = gpxPointsToGeoJSON(gpxPoints);
  const simplifiedGeoJSON = simplifyGPXLine(
    originalGeoJSON,
    options?.simplifyTolerance || 0.0001,
    true
  );
  const waypoints = extractWaypointsForRouting(
    simplifiedGeoJSON,
    options?.maxWaypoints || 200
  );

  return {
    originalGeoJSON,
    simplifiedGeoJSON,
    waypoints,
    gpxPoints,
  };
}
