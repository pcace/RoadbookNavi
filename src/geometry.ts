import {
  bbox,
  booleanPointInPolygon,
  point,
  feature,
  buffer,
} from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from 'geojson';
import type { Bbox, Region, Waypoint } from './model';
export function extent(value: unknown): Bbox {
  return bbox(value as Feature) as Bbox;
}
export function covered(p: Waypoint, regions: Region[]): boolean {
  return regions.some(r =>
    booleanPointInPolygon(point([p.lon, p.lat]), feature(r.geometry))
  );
}
export function detailBounds(p: Waypoint): Bbox {
  return extent(buffer(point([p.lon, p.lat]), 0.21, { units: 'kilometers' })!);
}
export function fmtBytes(n?: number): string {
  if (n == null) return 'unbekannt';
  return n >= 1024 * 1024 * 1024
    ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
    : n >= 1024 * 1024
      ? `${(n / 1024 / 1024).toFixed(1)} MB`
      : `${n} B`;
}
export function requireCoverage(points: Waypoint[], regions: Region[]) {
  const missing = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !covered(p, regions));
  if (missing.length) {
    const total = regions.reduce((sum, r) => sum + (r.size || 0), 0);
    throw new Error(
      `Gebiet nicht geladen: Wegpunkt ${missing[0].i + 1} (${missing[0].p.lat.toFixed(5)}, ${missing[0].p.lon.toFixed(5)}) liegt in keinem geladenen Gebiet. Geladen: ${regions.map(r => `${r.name} (${fmtBytes(r.size)})`).join(', ') || 'keine'} · Gebiete gesamt ${fmtBytes(total)}.`
    );
  }
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
