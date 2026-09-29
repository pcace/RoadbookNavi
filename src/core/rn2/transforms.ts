import { latLonToWebMercator, webMercatorToLatLon } from '../projections';
import { Point, LatLonPoint, Rn2TransformContext } from './types';
import { pickPivotIndexClosestToOrigin } from './utils';
import { SCALE_FACTOR } from './constants';

/**
 * Calculate the transform center for the turn display.
 * This logic was originally aligned with the former frontend tulip renderer.
 * The frontend now renders the roadbook as PDF in-app, but we keep this
 * transform behavior stable for RN2 exports.
 */
export const calculateTransformCenter = (turn: any): LatLonPoint => {
  const points = turn?.points as LatLonPoint[] | undefined;
  if (!points?.length) return { latitude: 0, longitude: 0 };

  const mainPoint = points[0] as any;
  const lastPoint = points[points.length - 1] as any;
  const prevPoint = (mainPoint?.prevPoint ?? mainPoint) as LatLonPoint;
  const nextPoint = (lastPoint?.nextPoint ?? lastPoint) as LatLonPoint;

  const isSingleTurn = points.length === 1;
  const prevExtendDistance = -20;
  const nextExtendDistance = isSingleTurn ? 30 : 0;

  const pointAtDistanceProjected = (
    from: LatLonPoint,
    to: LatLonPoint,
    dist: number
  ): LatLonPoint => {
    const [fromX, fromY] = latLonToWebMercator(from.latitude, from.longitude);
    const [toX, toY] = latLonToWebMercator(to.latitude, to.longitude);
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-7) {
      const [lat, lon] = webMercatorToLatLon(fromX, fromY + dist);
      return { latitude: lat, longitude: lon };
    }
    const nx = dx / len;
    const ny = dy / len;
    const px = fromX + nx * dist;
    const py = fromY + ny * dist;
    const [lat, lon] = webMercatorToLatLon(px, py);
    return { latitude: lat, longitude: lon };
  };

  const prevNorm = pointAtDistanceProjected(
    mainPoint,
    prevPoint,
    prevExtendDistance
  );
  const nextNorm = pointAtDistanceProjected(
    lastPoint,
    nextPoint,
    nextExtendDistance
  );

  const allRelevantPoints = [prevNorm, ...points, nextNorm];
  let sumLat = 0;
  let sumLon = 0;
  allRelevantPoints.forEach(p => {
    sumLat += p.latitude;
    sumLon += p.longitude;
  });

  return {
    latitude: sumLat / allRelevantPoints.length,
    longitude: sumLon / allRelevantPoints.length,
  };
};

/**
 * Creates a coordinate transformer that converts DB local coordinates to RN2 display coordinates.
 * Reconstructs world coords via WebMercator projection, then recenters to transformCenter.
 */
export const createCoordinateTransformer = (
  transformCenter: LatLonPoint,
  turn: any
) => {
  return (originalCoord: Point): Point => {
    const points = turn?.points as LatLonPoint[] | undefined;
    const mainPoint = points?.[0] as LatLonPoint | undefined;
    if (!mainPoint) return { x: originalCoord.x, y: originalCoord.y };

    const [mainMercatorX, mainMercatorY] = latLonToWebMercator(
      mainPoint.latitude,
      mainPoint.longitude
    );

    // Interpret the stored local coords as offsets in the same meter-like space
    // that the frontend assumes (WebMercator meters).
    const worldX = mainMercatorX + originalCoord.x;
    const worldY = mainMercatorY - originalCoord.y; // SVG y increases downward

    const [lat, lon] = webMercatorToLatLon(worldX, worldY);

    const [mercatorX, mercatorY] = latLonToWebMercator(lat, lon);
    const [centerX, centerY] = latLonToWebMercator(
      transformCenter.latitude,
      transformCenter.longitude
    );

    const x = (mercatorX - centerX) * 1;
    const y = -(mercatorY - centerY) * 1;
    return { x, y };
  };
};

/**
 * Rotates a point around origin by the given angle in degrees.
 */
export const rotatePoint = (p: Point, angleDeg: number): Point => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  };
};

/**
 * Computes rotation angle from the first turnPath segment.
 * Derived from the historical tulip rendering rotation convention.
 */
export const computeRotationDeg = (entry: any): number => {
  const tp = entry?.turnPath as Point[] | undefined;
  if (tp && tp.length >= 2) {
    const p1 = tp[0];
    const p2 = tp[1];
    const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angleDeg = (angleRad * 180) / Math.PI;
    return -angleDeg - 90;
  }
  return 0;
};

/**
 * Builds the complete RN2 transform context for a turn entry.
 * Returns a toRn2Point function that converts DB coords to final RN2 canvas coords,
 * and the transformed turnPath.
 */
export const buildRn2TransformContext = (entry: any): Rn2TransformContext => {
  const turn = entry?.turn;
  const rawTurnPath = (entry?.turnPath as Point[]) ?? [];

  const transformCenter = calculateTransformCenter(turn);
  const transformFn = createCoordinateTransformer(transformCenter, turn);
  const rotationDeg = computeRotationDeg(entry);

  // Apply recenter + rotation to turnPath first.
  const rotatedTurnPath = rawTurnPath.map(p =>
    rotatePoint(transformFn(p), rotationDeg)
  );

  // Find the first 0,0 point in the RAW turnPath to use as pivot
  const threshold = 0.001;
  const isNearOrigin = (p: Point) =>
    Math.sqrt(p.x * p.x + p.y * p.y) <= threshold;
  const firstZeroIndex = rawTurnPath.findIndex(isNearOrigin);

  // Use the transformed version of that original 0,0 point as pivot
  const pivotIndex =
    firstZeroIndex !== -1
      ? firstZeroIndex
      : pickPivotIndexClosestToOrigin(rotatedTurnPath);
  const pivot = rotatedTurnPath[pivotIndex] ?? { x: 0, y: 0 };

  const toRn2Point = (p: Point): Point => {
    const rotated = rotatePoint(transformFn(p), rotationDeg);
    return {
      x: (rotated.x - pivot.x) * SCALE_FACTOR,
      y: (rotated.y - pivot.y) * SCALE_FACTOR,
    };
  };

  return {
    toRn2Point,
    turnPath: rotatedTurnPath.map(p => ({
      x: (p.x - pivot.x) * SCALE_FACTOR,
      y: (p.y - pivot.y) * SCALE_FACTOR,
    })),
  };
};
