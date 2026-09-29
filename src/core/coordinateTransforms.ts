import { TransformContext, LocalCoordinate } from './types';
import { latLonToWebMercator } from './projections';

// createTransformContext removed; construct the context inline where needed

/**
 * Transform a line string from lat/lon coordinates to local pixel coordinates
 */
export function transformLineString(
  coordinates: [number, number][],
  context: TransformContext
): LocalCoordinate[] {
  const [centerX, centerY] = latLonToWebMercator(
    context.centerLat,
    context.centerLon
  );
  const ppm = context.pixelsPerMeter;

  return coordinates.map(([lon, lat]) => {
    const [xMeters, yMeters] = latLonToWebMercator(lat, lon);
    const x = (xMeters - centerX) * ppm;
    const y = (centerY - yMeters) * ppm; // invert Y for screen coords
    return { x, y };
  });
}

/**
 * Transform a single coordinate from lat/lon to local coordinates
 */
export function transformCoordinate(
  lat: number,
  lon: number,
  context: TransformContext
): LocalCoordinate {
  const [centerX, centerY] = latLonToWebMercator(
    context.centerLat,
    context.centerLon
  );
  const [xMeters, yMeters] = latLonToWebMercator(lat, lon);
  return {
    x: (xMeters - centerX) * context.pixelsPerMeter,
    y: (centerY - yMeters) * context.pixelsPerMeter,
  };
}

/**
 * Calculate distance between two geographic points in meters
 */
