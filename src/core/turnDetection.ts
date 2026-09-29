import { Turn, RoutePoint } from './types';
import { calculateDistance } from './geo';

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Find stable point index with sufficient distance
 */
function findStablePointIndex(
  points: RoutePoint[],
  currentIndex: number,
  direction: 'forward' | 'backward'
): number {
  const minDistanceMeters = 10;
  const maxSteps = 20;

  let targetIndex = currentIndex;
  const step = direction === 'forward' ? 1 : -1;
  const currentPoint = points[currentIndex];

  for (let steps = 1; steps <= maxSteps; steps++) {
    const candidateIndex = currentIndex + step * steps;

    if (candidateIndex < 0 || candidateIndex >= points.length) {
      break;
    }

    const candidatePoint = points[candidateIndex];
    const dist = calculateDistance(
      currentPoint.latitude,
      currentPoint.longitude,
      candidatePoint.latitude,
      candidatePoint.longitude
    );

    targetIndex = candidateIndex;

    if (dist >= minDistanceMeters) {
      break;
    }
  }

  return targetIndex;
}

/**
 * Calculate stable bearing with minimum distance
 */
function calculateStableBearing(
  currentPoint: RoutePoint,
  points: RoutePoint[],
  currentIndex: number,
  direction: 'forward' | 'backward'
): number {
  const targetIndex = findStablePointIndex(points, currentIndex, direction);
  const targetPoint = points[targetIndex];

  if (direction === 'forward') {
    return calculateBearing(
      currentPoint.latitude,
      currentPoint.longitude,
      targetPoint.latitude,
      targetPoint.longitude
    );
  } else {
    return calculateBearing(
      targetPoint.latitude,
      targetPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    );
  }
}

/**
 * Generate turn instruction based on commandIndex from voicehints
 */
function generateInstructionFromCommandIndex(
  commandIndex: number,
  wayTags: string
): string {
  // BRouter commandIndex mapping:
  // 0=straight, 1=TR, 2=TL, 3=sharp right, 4=sharp left,
  // 5=slight right, 6=slight left, 7=u-turn
  const commandMap: { [key: number]: string } = {
    0: 'Geradeaus',
    1: 'Rechts',
    2: 'Links',
    3: 'Scharf rechts',
    4: 'Scharf links',
    5: 'Leicht rechts',
    6: 'Leicht links',
    7: 'Wenden',
  };

  const directionText = commandMap[commandIndex] || 'Geradeaus';
  const terrainInfo = extractTerrainFromTags(wayTags);

  return `${directionText}${terrainInfo ? ` auf ${terrainInfo}` : ''}`;
}

/**
 * Extract terrain info from wayTags
 */
function extractTerrainFromTags(wayTags: string): string {
  if (wayTags.includes('highway=track')) return 'Feldweg';
  if (wayTags.includes('highway=secondary')) return 'Landstraße';
  if (wayTags.includes('highway=tertiary')) return 'Kreisstraße';
  if (wayTags.includes('highway=residential')) return 'Ortsstraße';
  return '';
}

/**
 * Detect turns based on voicehints data in RoutePoints
 * With voicehints, turns are already identified by BRouter
 */
export function detectTurns(points: RoutePoint[]): Turn[] {
  const turns: Turn[] = [];

  if (points.length === 0) return turns;

  // Add start entry (first point, no commandIndex)
  if (points.length > 0) {
    const startPoint = points[0];
    let startBearing = 0;
    if (points.length > 1) {
      startBearing = calculateStableBearing(startPoint, points, 0, 'forward');
    }
    turns.push({
      id: 'turn-start',
      points: [startPoint],
      angle: 0,
      bearing: startBearing,
      distanceFromStart: 0,
      instruction: 'Start',
    });
  }

  // Process points with commandIndex (from voicehints)
  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];

    // If point has commandIndex, it's a turn from voicehints
    if (currentPoint.commandIndex !== undefined) {
      const angle = currentPoint.turnAngleFromHint || 0;
      const instruction = generateInstructionFromCommandIndex(
        currentPoint.commandIndex,
        currentPoint.wayTags
      );

      const bearingOut = calculateStableBearing(
        currentPoint,
        points,
        i,
        'forward'
      );

      turns.push({
        id: `turn-${i}`,
        points: [currentPoint],
        angle,
        bearing: bearingOut,
        distanceFromStart: currentPoint.totalDistance,
        instruction,
        terrainChange: undefined,
      });
    }
  }

  // Add finish entry (last point if it doesn't have commandIndex or add separate)
  if (points.length > 1) {
    const finishPoint = points[points.length - 1];

    // Only add finish if last point is not already a turn
    if (finishPoint.commandIndex === undefined) {
      let finishBearing = 0;
      finishBearing = calculateBearing(
        points[points.length - 2].latitude,
        points[points.length - 2].longitude,
        finishPoint.latitude,
        finishPoint.longitude
      );

      turns.push({
        id: 'turn-finish',
        points: [finishPoint],
        angle: 0,
        bearing: finishBearing,
        distanceFromStart: finishPoint.totalDistance,
        instruction: 'Ziel erreicht',
      });
    }
  }

  return turns;
}
