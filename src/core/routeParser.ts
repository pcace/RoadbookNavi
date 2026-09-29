import { BRouterGeoJSON, BRouterMessage, RoutePoint } from './types';
import { calculateDistance } from './geo';
import { lineString } from '@turf/helpers';
import { length as turfLength } from '@turf/turf';

/**
 * Finds a coordinate at least the requested distance from the current index.
 */
function findDistantCoordinate(
  coordinates: [number, number, number][],
  currentIndex: number,
  direction: number, // -1 for backward, 1 for forward
  minDistance: number,
  currentLat: number,
  currentLon: number
): number {
  let targetIndex = currentIndex;

  for (let steps = 1; steps < coordinates.length; steps++) {
    const candidateIndex = currentIndex + direction * steps;

    // Clamp the index to the available coordinates.
    if (candidateIndex < 0 || candidateIndex >= coordinates.length) {
      break;
    }

    const candidateCoord = coordinates[candidateIndex];
    const distance = calculateDistance(
      currentLat,
      currentLon,
      candidateCoord[1],
      candidateCoord[0]
    );

    targetIndex = candidateIndex;

    // Stop after reaching the requested minimum distance.
    if (distance >= minDistance) {
      break;
    }
  }

  return targetIndex;
}

/**
 * Calculates cumulative distance along the route up to a coordinate index.
 */
function calculateDistanceToCoordinateIndex(
  coordinates: [number, number, number][],
  targetIndex: number
): number {
  if (targetIndex <= 0) return 0;
  if (targetIndex >= coordinates.length) {
    targetIndex = coordinates.length - 1;
  }

  // Slice from the starting point through the target index.
  const slicedCoords = coordinates.slice(0, targetIndex + 1);

  // Build the LineString and calculate its length.
  const line = lineString(slicedCoords.map(coord => [coord[0], coord[1]]));
  const lengthKm = turfLength(line, { units: 'kilometers' });

  // Convert kilometres to metres.
  return Math.round(lengthKm * 1000);
}

/**
 * Finds the BRouter message matching a coordinate.
 */
function findMatchingMessage(
  messages: BRouterMessage[],
  targetLon: number,
  targetLat: number
): BRouterMessage | undefined {
  // Message coordinates are encoded as longitude/latitude multiplied by 1,000,000.
  const targetLonInt = Math.round(targetLon * 1000000);
  const targetLatInt = Math.round(targetLat * 1000000);

  return messages.find(msg => {
    const msgLon = parseInt(msg[0], 10);
    const msgLat = parseInt(msg[1], 10);
    // Allow ±1 to account for rounding errors.
    return (
      Math.abs(msgLon - targetLonInt) <= 1 &&
      Math.abs(msgLat - targetLatInt) <= 1
    );
  });
}

/**
 * Parses BRouter GeoJSON into the internal route point representation.
 */
export function parseRoute(geojson: BRouterGeoJSON): RoutePoint[] {
  const feature = geojson.features[0];
  if (!feature) {
    console.error('parseRoute: No route feature found');
    throw new Error('No route feature found');
  }

  const voicehints = feature.properties.voicehints || [];
  const coordinates = feature.geometry.coordinates;
  const messages = feature.properties.messages;
  const dataMessages = messages.slice(1) as BRouterMessage[];

  // Straight short routes legitimately have no intermediate voice hints.
  if (coordinates.length < 2)
    throw new Error('Route needs at least two coordinates');

  const result: RoutePoint[] = [];

  // 1. Add the starting point, which is absent from voice hints.
  const startCoord = coordinates[0];
  const startMessage = dataMessages[0];

  const startNextCoordIndex = findDistantCoordinate(
    coordinates,
    0,
    1,
    2, // minBearingDistance
    startCoord[1],
    startCoord[0]
  );
  const startNextCoord = coordinates[startNextCoordIndex];

  const startPoint: RoutePoint = {
    longitude: startCoord[0],
    latitude: startCoord[1],
    prevPoint: {
      latitude: startCoord[1],
      longitude: startCoord[0],
    }, // The starting point is its own previous point.
    nextPoint: {
      latitude: startNextCoord[1],
      longitude: startNextCoord[0],
    },
    elevation: startCoord[2] || parseInt(startMessage?.[2] || '0', 10),
    distance: 0,
    time: 0,
    wayTags: startMessage?.[9] || '',
    nodeTags: startMessage?.[10] || '',
    totalDistance: 0,
  };
  result.push(startPoint);

  // 2. Create one route point for every voice hint.
  for (const hint of voicehints) {
    const [indexInTrack, commandIndex, , , angle] = hint;

    // 2a. Read coordinates from geometry.coordinates.
    const coord = coordinates[indexInTrack];
    if (!coord) {
      console.warn(
        `parseRoute: No coordinate found for indexInTrack ${indexInTrack}`
      );
      continue;
    }

    // 2b. Find the corresponding message for detailed metadata.
    const matchedMessage = findMatchingMessage(
      dataMessages,
      coord[0],
      coord[1]
    );

    if (!matchedMessage) {
      console.warn(
        `parseRoute: No matching message found for voicehint at ${coord[0]}, ${coord[1]}`
      );
    }

    // 2c. Calculate previous and next points.
    const prevCoordIndex = findDistantCoordinate(
      coordinates,
      indexInTrack,
      -1,
      2, // minBearingDistance
      coord[1],
      coord[0]
    );
    const nextCoordIndex = findDistantCoordinate(
      coordinates,
      indexInTrack,
      1,
      2, // minBearingDistance
      coord[1],
      coord[0]
    );

    const prevCoord = coordinates[prevCoordIndex];
    const nextCoord = coordinates[nextCoordIndex];

    // 2d. Calculate cumulative distance along the route.
    const totalDistance = calculateDistanceToCoordinateIndex(
      coordinates,
      indexInTrack
    );

    // 2e. Build the route point.
    const point: RoutePoint = {
      longitude: coord[0],
      latitude: coord[1],
      prevPoint: {
        latitude: prevCoord[1],
        longitude: prevCoord[0],
      },
      nextPoint: {
        latitude: nextCoord[1],
        longitude: nextCoord[0],
      },
      elevation: coord[2] || parseInt(matchedMessage?.[2] || '0', 10),
      distance: parseInt(matchedMessage?.[3] || '0', 10),
      time: parseInt(matchedMessage?.[11] || '0', 10),
      wayTags: matchedMessage?.[9] || '',
      nodeTags: matchedMessage?.[10] || '',
      totalDistance,
      commandIndex,
      turnAngleFromHint: angle,
    };

    result.push(point);
  }

  // 3. Add the final coordinate as the finish point.
  // Add only if this is not already the final voice-hint point.
  const lastCoordIndex = coordinates.length - 1;
  const lastCoord = coordinates[lastCoordIndex];
  const lastVoicehintIndex = voicehints[voicehints.length - 1]?.[0];

  // Add a finish point when the final voice hint is not the final coordinate.
  if (lastVoicehintIndex !== lastCoordIndex) {
    const finishMessage = findMatchingMessage(
      dataMessages,
      lastCoord[0],
      lastCoord[1]
    );

    const prevCoordIndex = findDistantCoordinate(
      coordinates,
      lastCoordIndex,
      -1,
      2, // minBearingDistance
      lastCoord[1],
      lastCoord[0]
    );
    const prevCoord = coordinates[prevCoordIndex];

    const finishTotalDistance = calculateDistanceToCoordinateIndex(
      coordinates,
      lastCoordIndex
    );

    const finishPoint: RoutePoint = {
      longitude: lastCoord[0],
      latitude: lastCoord[1],
      prevPoint: {
        latitude: prevCoord[1],
        longitude: prevCoord[0],
      },
      nextPoint: {
        // The finish point is its own next point.
        latitude: lastCoord[1],
        longitude: lastCoord[0],
      },
      elevation: lastCoord[2] || parseInt(finishMessage?.[2] || '0', 10),
      distance: parseInt(finishMessage?.[3] || '0', 10),
      time: parseInt(finishMessage?.[11] || '0', 10),
      wayTags: finishMessage?.[9] || '',
      nodeTags: finishMessage?.[10] || '',
      totalDistance: finishTotalDistance,
    };

    result.push(finishPoint);
  }

  return result;
}

/**
 * Extracts the surface type from way tags.
 */
export function extractSurfaceType(wayTags: string): string {
  if (wayTags.includes('surface=asphalt')) return 'Asphalt';
  if (wayTags.includes('surface=concrete')) return 'Beton';
  if (wayTags.includes('surface=paved')) return 'Gepflastert';
  if (wayTags.includes('surface=unpaved')) return 'Unbefestigt';
  if (wayTags.includes('surface=gravel')) return 'Schotter';
  if (wayTags.includes('surface=dirt')) return 'Erde';
  if (wayTags.includes('surface=grass')) return 'Gras';
  if (wayTags.includes('surface=sand')) return 'Sand';
  return 'Unbekannt';
}
