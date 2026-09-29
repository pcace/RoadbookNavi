const randomUUID = () => globalThis.crypto.randomUUID();
import { Point } from './types';
import { BUILDING_OFFSET } from './constants';
import { terrainToTypeId } from './utils';
import { polylineHandles, roadLayers } from './curves';

const MAX_DISTANCE_FROM_OFFSET = 200;

/**
 * Simplifies a polygon using the Ramer-Douglas-Peucker algorithm.
 * Reduces the number of points while preserving the shape.
 */
const simplifyPolygon = (points: Point[], tolerance: number = 2): Point[] => {
  if (points.length <= 2) return points;

  const perpendicularDistance = (
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const norm = Math.sqrt(dx * dx + dy * dy);
    if (norm === 0)
      return Math.sqrt(
        (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
      );
    return (
      Math.abs(
        dy * point.x -
          dx * point.y +
          lineEnd.x * lineStart.y -
          lineEnd.y * lineStart.x
      ) / norm
    );
  };

  const douglasPeucker = (pts: Point[], epsilon: number): Point[] => {
    if (pts.length <= 2) return pts;

    let maxDist = 0;
    let index = 0;
    const end = pts.length - 1;

    for (let i = 1; i < end; i++) {
      const dist = perpendicularDistance(pts[i], pts[0], pts[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = douglasPeucker(pts.slice(0, index + 1), epsilon);
      const right = douglasPeucker(pts.slice(index), epsilon);
      return [...left.slice(0, -1), ...right];
    }

    return [pts[0], pts[end]];
  };

  return douglasPeucker(points, tolerance);
};

/**
 * Filters points that are too far from the reference point (beyond max distance).
 */
const filterPointsByDistance = (
  points: Point[],
  referencePoint: Point,
  maxDistance: number
): Point[] => {
  return points.filter(p => {
    const dist = Math.sqrt(
      (p.x - referencePoint.x) ** 2 + (p.y - referencePoint.y) ** 2
    );
    return dist <= maxDistance;
  });
};

/**
 * Builds Track element from the transformed turnPath.
 * Splits the path at 0,0 points into roadIn and roadOut segments.
 */
const buildRawTrack = (turnPath: Point[]) => {
  if (!turnPath || turnPath.length < 2) return null;

  // Filter out all points near origin (0,0) since RN2 always starts from (0,0)
  const threshold = 0.001;
  const isNearOrigin = (p: Point) =>
    Math.sqrt(p.x * p.x + p.y * p.y) <= threshold;

  // Find the first and last occurrence of 0,0 to split the path
  const firstZeroIndex = turnPath.findIndex(isNearOrigin);

  if (firstZeroIndex === -1) {
    // No 0,0 found, treat entire path as roadOut
    const filteredPath = turnPath.filter(p => !isNearOrigin(p));
    return {
      type: 'Track',
      roadOut:
        filteredPath.length >= 1
          ? {
              end: filteredPath[filteredPath.length - 1],
              handles: filteredPath.slice(0, -1),
              typeId: 17,
              z: 10,
            }
          : { handles: [], typeId: 17, z: 10 },
      roadIn: {},
      z: 10,
      eId: randomUUID(),
      rerender: false,
    };
  }

  // Find the last 0,0 by searching backwards
  let lastZeroIndex = firstZeroIndex;
  for (let i = firstZeroIndex + 1; i < turnPath.length; i++) {
    if (isNearOrigin(turnPath[i])) {
      lastZeroIndex = i;
    }
  }

  // Split: everything before first 0,0 = roadIn, everything after last 0,0 = roadOut
  const inSegment = turnPath
    .slice(0, firstZeroIndex)
    .filter(p => !isNearOrigin(p));
  const outSegment = turnPath
    .slice(lastZeroIndex + 1)
    .filter(p => !isNearOrigin(p));

  // roadIn: end = first point (farthest from center), handles = rest in reverse order
  const roadIn =
    inSegment.length >= 1
      ? {
          end: inSegment[0],
          handles: inSegment.slice(1).reverse(),
          typeId: 17,
          z: 10,
        }
      : {};

  // roadOut: end = last point, handles = all points before last
  const roadOut =
    outSegment.length >= 1
      ? {
          end: outSegment[outSegment.length - 1],
          handles: outSegment.slice(0, -1),
          typeId: 17,
          z: 10,
        }
      : { handles: [], typeId: 17, z: 10 };

  return {
    type: 'Track',
    roadOut,
    roadIn,
    z: 10,
    eId: randomUUID(),
    rerender: false,
  };
};

/** Preserve the turn path's corners in RN2's spline-based Track geometry. */
export const buildTrackFromTurnPath = (turnPath: Point[]) => {
  const track = buildRawTrack(turnPath);
  if (track)
    for (const road of [track.roadIn, track.roadOut] as {
      end?: Point;
      handles?: Point[];
    }[]) {
      if (road.end)
        road.handles = polylineHandles(
          { x: 0, y: 0 },
          road.handles || [],
          road.end
        );
    }
  return track;
};

/** Buildings are closed Line polygons with a gray stroke. */
export const buildBuildingElements = (
  entry: any,
  toRn2Point: (p: Point) => Point
) => {
  const buildings = entry?.buildings as Point[][] | undefined;
  if (!buildings?.length) return [] as any[];

  const result = buildings
    .map(poly => {
      if (!poly || poly.length === 0) return null;

      // Transform to RN2 coordinates
      let coords = [...poly].map(toRn2Point);

      // Filter points by distance from offset point
      coords = filterPointsByDistance(
        coords,
        { x: 0, y: 0 },
        MAX_DISTANCE_FROM_OFFSET
      );

      if (coords.length < 3) return null; // Need at least 3 points for a polygon

      // Simplify the polygon
      coords = simplifyPolygon(coords, 1.5);

      if (coords.length < 3) return null;

      // Apply offset
      coords = coords.map(p => ({
        x: p.x + BUILDING_OFFSET.x,
        y: p.y + BUILDING_OFFSET.y,
      }));

      const path: (string | number)[][] = [];
      path.push(['M', coords[0].x, coords[0].y]);
      coords.slice(1).forEach(p => {
        path.push(['L', p.x, p.y]);
      });
      // ensure closed shape
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
        path.push(['L', first.x, first.y]);
      }

      return {
        type: 'Line',
        eId: randomUUID(),
        path,
        dirty: true,
        fill: 'transparent',
        stroke: '#636363ff',
        strokeWidth: 2,
        strokeLineCap: 'round',
        rerender: false,
        z: 3,
        pathOffset: { x: 0, y: 0 },
      };
    })
    .filter(Boolean) as any[];

  return result;
};

/**
 * Builds Line elements for waterways.
 * Waterways are rendered as blue lines.
 */
export const buildWaterwayElements = (
  entry: any,
  toRn2Point: (p: Point) => Point
) => {
  const waterways = entry?.waterways as Point[][] | undefined;
  if (!waterways?.length) return [] as any[];

  const result = waterways
    .map(line => {
      if (!line || line.length === 0) return null;

      // Transform to RN2 coordinates
      let coords = line.map(toRn2Point);

      // Filter points by distance from offset point
      coords = filterPointsByDistance(
        coords,
        { x: 0, y: 0 },
        MAX_DISTANCE_FROM_OFFSET
      );

      if (coords.length < 2) return null; // Need at least 2 points for a line

      // Simplify the line
      coords = simplifyPolygon(coords, 1.5);

      if (coords.length < 2) return null;

      // Apply offset
      coords = coords.map(p => ({
        x: p.x + BUILDING_OFFSET.x,
        y: p.y + BUILDING_OFFSET.y,
      }));

      const path: (string | number)[][] = [];
      path.push(['M', coords[0].x, coords[0].y]);
      coords.slice(1).forEach(p => {
        path.push(['L', p.x, p.y]);
      });

      return {
        type: 'Line',
        eId: randomUUID(),
        path,
        dirty: true,
        fill: 'transparent',
        stroke: '#A9D3EF', // Blue color for waterways
        strokeWidth: 2,
        strokeLineCap: 'round',
        rerender: false,
        z: 3,
        pathOffset: { x: 0, y: 0 },
      };
    })
    .filter(Boolean) as any[];

  return result;
};

/**
 * Builds Road elements from highway data.
 * Roads are rendered with start/end points and intermediate handles.
 */
export const buildRoadElements = (
  entry: any,
  toRn2Point: (p: Point) => Point
) => {
  const highways = entry?.highways as
    { coords: Point[]; type: string }[] | undefined;
  if (!highways?.length) return [] as any[];

  const result = highways
    .map(h => {
      const coordsIn = (h?.coords || []) as Point[];
      if (coordsIn.length < 2) return null;

      // Transform to RN2 coordinates and sort by center
      const coords = coordsIn.map(toRn2Point);

      // Line paths preserve OSM corners exactly; RN2 Road handles would
      // reinterpret every vertex as a smooth spline interpolation point.
      const path = coords.map((p, i) => [
        i ? 'L' : 'M',
        p.x + BUILDING_OFFSET.x,
        p.y + BUILDING_OFFSET.y,
      ]);
      return roadLayers(terrainToTypeId(h.type)).map(layer => ({
        type: 'Line',
        path,
        fill: 'transparent',
        stroke: layer.color,
        strokeWidth: layer.width,
        strokeDashArray: layer.dash?.split(' ').map(Number),
        strokeLineCap: 'round',
        z: 4,
        eId: randomUUID(),
        rerender: false,
        pathOffset: { x: 0, y: 0 },
      }));
    })
    .filter(Boolean)
    .flat() as any[];

  return result;
};
