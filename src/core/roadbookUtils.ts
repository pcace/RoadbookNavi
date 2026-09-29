import { LocalCoordinate, TransformContext, Turn } from './types';
import { transformLineString } from './coordinateTransforms';
// transformLineString now imported from './coordinateTransforms'

function transformPolygonRings(
  geometry: any,
  transformContext: TransformContext
): LocalCoordinate[][] {
  if (!geometry?.coordinates) {
    return [];
  }

  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0];
    if (!Array.isArray(outerRing) || outerRing.length < 4) {
      return [];
    }

    return [
      transformLineString(outerRing as [number, number][], transformContext),
    ];
  }

  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as [number, number][][][])
      .map(polygon => polygon?.[0])
      .filter(
        (outerRing): outerRing is [number, number][] =>
          Array.isArray(outerRing) && outerRing.length >= 4
      )
      .map(outerRing => transformLineString(outerRing, transformContext));
  }

  return [];
}

export function filterTurns(turns: Turn[], tolerance = 5): Turn[] {
  const filteredTurns: Turn[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    if (
      turn.instruction.includes('Start') ||
      turn.instruction.includes('Ziel')
    ) {
      filteredTurns.push(turn);
      continue;
    }

    const absAngle = Math.abs(turn.angle);
    if (absAngle < 180 + tolerance && absAngle > 180 - tolerance) {
      const currentHighwayType = turn.points?.[0]?.wayTags ?? 'unknown';
      let nextTurn: Turn | null = null;
      for (let j = i + 1; j < turns.length; j++) {
        if (
          !turns[j].instruction.includes('Start') &&
          !turns[j].instruction.includes('Ziel')
        ) {
          nextTurn = turns[j];
          break;
        }
      }

      let shouldFilter = false;

      if (!shouldFilter && nextTurn) {
        const nextHighwayType = nextTurn.points?.[0]?.wayTags ?? 'unknown';
        if (
          currentHighwayType === nextHighwayType &&
          currentHighwayType !== 'unknown'
        ) {
          shouldFilter = true;
        }
      }

      if (shouldFilter) continue;
    }

    filteredTurns.push(turn);
  }

  return filteredTurns;
}

/**
 * Process OSM features and categorize them
 */
export function processOSMFeatures(features: any[], transformContext: any) {
  const highways: { coords: LocalCoordinate[]; type: string }[] = [];
  const buildings: LocalCoordinate[][] = [];
  const railways: LocalCoordinate[][] = [];
  const waterways: LocalCoordinate[][] = [];
  const powerLines: LocalCoordinate[][] = [];
  const treeRows: LocalCoordinate[][] = [];
  const naturalWater: LocalCoordinate[][] = [];
  const masts: LocalCoordinate[] = [];
  const powerPoles: LocalCoordinate[] = [];
  const powerTowers: LocalCoordinate[] = [];
  const antennas: LocalCoordinate[] = [];
  const wells: LocalCoordinate[] = [];
  const streetLamps: LocalCoordinate[] = [];
  const trafficSigns: LocalCoordinate[] = [];
  const trees: LocalCoordinate[] = [];

  features.forEach((feature: any) => {
    if (feature.geometry.type === 'LineString') {
      const localCoords = transformLineString(
        feature.geometry.coordinates as [number, number][],
        transformContext
      );
      if (feature.properties?.highway) {
        highways.push({
          coords: localCoords,
          type: feature.properties.highway,
        });
      } else if (feature.properties?.building) {
        buildings.push(localCoords);
      } else if (feature.properties?.railway) {
        railways.push(localCoords);
      } else if (feature.properties?.waterway) {
        waterways.push(localCoords);
      } else if (feature.properties?.power === 'line') {
        powerLines.push(localCoords);
      } else if (feature.properties?.natural === 'tree_row') {
        treeRows.push(localCoords);
      } else if (feature.properties?.natural === 'water') {
        naturalWater.push(localCoords);
      }
    } else if (
      feature.geometry.type === 'Polygon' ||
      feature.geometry.type === 'MultiPolygon'
    ) {
      const localPolygons = transformPolygonRings(
        feature.geometry,
        transformContext
      );

      if (localPolygons.length === 0) {
        return;
      }

      if (feature.properties?.building) {
        buildings.push(...localPolygons);
      } else if (
        feature.properties?.natural === 'water' ||
        feature.properties?.waterway === 'riverbank' ||
        feature.properties?.water
      ) {
        naturalWater.push(...localPolygons);
      }
    } else if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates;
      const localCoord = transformLineString([[lon, lat]], transformContext)[0];

      if (feature.properties?.man_made === 'mast') {
        masts.push(localCoord);
      } else if (feature.properties?.power === 'pole') {
        powerPoles.push(localCoord);
      } else if (feature.properties?.power === 'tower') {
        powerTowers.push(localCoord);
      } else if (feature.properties?.man_made === 'antenna') {
        antennas.push(localCoord);
      } else if (feature.properties?.man_made === 'water_well') {
        wells.push(localCoord);
      } else if (feature.properties?.highway === 'street_lamp') {
        streetLamps.push(localCoord);
      } else if (feature.properties?.traffic_sign) {
        trafficSigns.push(localCoord);
      } else if (feature.properties?.natural === 'tree') {
        trees.push(localCoord);
      }
    }
  });

  return {
    highways,
    buildings,
    railways,
    waterways,
    powerLines,
    treeRows,
    naturalWater,
    masts,
    powerPoles,
    powerTowers,
    antennas,
    wells,
    streetLamps,
    trafficSigns,
    trees,
  };
}

/**
 * Process route coordinates
 */
export function processRouteCoordinates(
  coordinates: [number, number, number][],
  transformContext: TransformContext
): LocalCoordinate[] {
  return transformLineString(
    coordinates.map(([lon, lat]) => [lon, lat]),
    transformContext
  );
}
