import { bbox, point, buffer } from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from 'geojson';
import type { Bbox, Waypoint } from './model';
export function extent(value: unknown): Bbox {
  return bbox(value as Feature) as Bbox;
}
export function detailBounds(p: Waypoint): Bbox {
  return extent(buffer(point([p.lon, p.lat]), 0.21, { units: 'kilometers' })!);
}
export function serializePolygons(data: FeatureCollection): string {
  return data.features
    .flatMap(f => {
      const g = f.geometry as Polygon | MultiPolygon;
      const polygons =
        g.type === 'Polygon'
          ? [g.coordinates]
          : g.type === 'MultiPolygon'
            ? g.coordinates
            : [];
      // BRouter's no-go polygon interface cannot encode holes. Conservatively
      // exclude the outer area including holes, matching the existing application.
      return polygons.map(p =>
        p[0].flatMap(c => [c[0].toFixed(6), c[1].toFixed(6)]).join(',')
      );
    })
    .join('|');
}
