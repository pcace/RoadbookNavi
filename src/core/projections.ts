// Shared proj4 configuration for all coordinate transformations.
import proj4 from 'proj4';

// Definiere Projektionen
export const WGS84 = 'EPSG:4326'; // Standard GPS Koordinaten
export const WEB_MERCATOR = 'EPSG:3857'; // Web Mercator for metre-based calculations.

// Register the projection definitions used by the renderer.
proj4.defs([
  [
    'EPSG:4326',
    '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees',
  ],
  [
    'EPSG:3857',
    '+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
  ],
]);

// Export proj4 for call sites that need direct transformations.
export { default as proj4 } from 'proj4';

/**
 * Helpers for common coordinate transformations.
 */

/**
 * Transformiert WGS84 zu Web Mercator
 */
export function latLonToWebMercator(
  lat: number,
  lon: number
): [number, number] {
  const [x, y] = proj4(WGS84, WEB_MERCATOR, [lon, lat]);
  return [x, y];
}

/**
 * Transformiert Web Mercator zu WGS84
 */
export function webMercatorToLatLon(x: number, y: number): [number, number] {
  const [lon, lat] = proj4(WEB_MERCATOR, WGS84, [x, y]);
  return [lat, lon];
}
