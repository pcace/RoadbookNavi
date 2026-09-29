import { Turn } from './types';
import { lineString, point } from '@turf/helpers';
import { lineSliceAlong, lineSplit, nearestPointOnLine } from '@turf/turf';

export const clipTurnPath = (track: [number, number][], turn: Turn) => {
  // For long routes, limit to relevant coordinates around the turn point
  // This solves the nearestPointOnLine performance issue with 3000+ coordinates
  const turnPoint = turn.points?.[0];
  let relevantTrack = track;

  if (turnPoint && track.length > 1000) {
    // Find the approximate index of the turn point in the track
    let closestIndex = 0;
    let minDist = Number.MAX_VALUE;

    for (let i = 0; i < track.length; i++) {
      const dx = track[i][0] - turnPoint.longitude;
      const dy = track[i][1] - turnPoint.latitude;
      const dist = dx * dx + dy * dy; // squared distance is sufficient for comparison

      if (dist < minDist) {
        minDist = dist;
        closestIndex = i;
      }
    }

    // Use coordinates within ±250 indices around the turn (should cover ~10-20km)
    const radius = 250;
    const startIdx = Math.max(0, closestIndex - radius);
    const endIdx = Math.min(track.length, closestIndex + radius);
    relevantTrack = track.slice(startIdx, endIdx);
  }

  // Ensure coordinates are real arrays
  const cleanedTrack = relevantTrack.map(coord => [coord[0], coord[1]]);

  // Validate coordinates
  const invalidTrackPoints: Array<{ idx: number; coord: any }> = [];
  cleanedTrack.forEach((coord, idx) => {
    if (
      !coord ||
      coord.length < 2 ||
      typeof coord[0] !== 'number' ||
      typeof coord[1] !== 'number' ||
      isNaN(coord[0]) ||
      isNaN(coord[1])
    ) {
      invalidTrackPoints.push({ idx, coord });
    }
  });

  if (invalidTrackPoints.length > 0) {
    console.error(
      `[clipTurnPath] Found ${invalidTrackPoints.length} invalid track coordinates out of ${track.length}`
    );
    console.error(`  - First 10 invalid:`, invalidTrackPoints.slice(0, 10));
    throw new Error(
      `Track contains ${invalidTrackPoints.length} invalid coordinates`
    );
  }

  const trackPath = lineString(cleanedTrack);

  // Validate ALL coordinates in the created trackPath
  const invalidPathCoords: Array<{
    idx: number;
    coord: any;
    issues: string[];
  }> = [];
  trackPath.geometry.coordinates.forEach((coord, idx) => {
    const issues: string[] = [];

    if (!coord) {
      issues.push('coord is null/undefined');
    } else if (!Array.isArray(coord)) {
      issues.push(`coord is not an array, type: ${typeof coord}`);
    } else {
      if (coord.length < 2) issues.push(`length is ${coord.length}`);
      if (typeof coord[0] !== 'number')
        issues.push(`coord[0] type: ${typeof coord[0]}`);
      if (typeof coord[1] !== 'number')
        issues.push(`coord[1] type: ${typeof coord[1]}`);
      if (isNaN(coord[0])) issues.push(`coord[0] is NaN`);
      if (isNaN(coord[1])) issues.push(`coord[1] is NaN`);
    }

    if (issues.length > 0) {
      invalidPathCoords.push({ idx, coord, issues });
    }
  });

  if (invalidPathCoords.length > 0) {
    console.error(
      `[clipTurnPath] Found ${invalidPathCoords.length} invalid coords in trackPath.geometry.coordinates`
    );
    console.error(`  - First 10 invalid:`, invalidPathCoords.slice(0, 10));
    throw new Error(
      `trackPath contains ${invalidPathCoords.length} invalid coordinates after lineString creation`
    );
  }

  const isFinish = turn.id.includes('finish');
  const isStart = turn.id.includes('start');

  const pointsOnTrack = turn.points
    .map((turnPoint, idx) => {
      // Validate coordinates before processing
      const lon = turnPoint.longitude;
      const lat = turnPoint.latitude;

      if (
        typeof lon !== 'number' ||
        typeof lat !== 'number' ||
        isNaN(lon) ||
        isNaN(lat)
      ) {
        console.error(
          `[clipTurnPath] Invalid coordinates for turn ${turn.id}, point ${idx}:`
        );
        console.error(`  - longitude: ${lon} (type: ${typeof lon})`);
        console.error(`  - latitude: ${lat} (type: ${typeof lat})`);
        return null;
      }

      const pt = point([lon, lat]);

      try {
        return nearestPointOnLine(trackPath, pt);
      } catch (error) {
        console.error(
          `[clipTurnPath] nearestPointOnLine failed for turn ${turn.id}, point ${idx}`
        );
        console.error(`  - Error:`, error);
        throw error;
      }
    })
    .filter(p => p !== null); // Filter out invalid points
  if (pointsOnTrack.length === 0) {
    return null;
  }

  // Build every segment: before the first point, between points, and after the last point.
  let splitParts: ReturnType<typeof lineSliceAlong>[] = [];

  if (pointsOnTrack.length === 1) {
    // Special case for a single point.
    const singlePoint = pointsOnTrack[0];
    const splittedLine = lineSplit(trackPath, singlePoint).features;
    if (splittedLine.length >= 2) {
      // Segment before the point: the final 10 m of the first part, reversed.
      const beforeSection = {
        ...splittedLine[0],
        geometry: {
          ...splittedLine[0].geometry,
          coordinates: splittedLine[0].geometry.coordinates.reverse(),
        },
      };
      const slicedBeforeSection = lineSliceAlong(beforeSection, 0, 20, {
        units: 'meters',
      });
      const finalBeforeSection = {
        ...slicedBeforeSection,
        geometry: {
          ...slicedBeforeSection.geometry,
          coordinates: slicedBeforeSection.geometry.coordinates.reverse(),
        },
      };
      splitParts.push(finalBeforeSection);

      // Segment after the point: the first 10 m of the second part.
      const afterSection = lineSliceAlong(splittedLine[1], 0, 20, {
        units: 'meters',
      });
      splitParts.push(afterSection);
    }

    if (isStart) {
      splitParts.push(
        lineSliceAlong(trackPath, 0, 20, {
          units: 'meters',
        })
      );
    }
    // adds the last section before finish
    if (isFinish) {
      const beforeSection = {
        ...trackPath,
        geometry: {
          ...trackPath.geometry,
          coordinates: trackPath.geometry.coordinates.reverse(),
        },
      };
      const slicedBeforeSection = lineSliceAlong(beforeSection, 0, 20, {
        units: 'meters',
      });
      const finalBeforeSection = {
        ...slicedBeforeSection,
        geometry: {
          ...slicedBeforeSection.geometry,
          coordinates: slicedBeforeSection.geometry.coordinates.reverse(),
        },
      };
      splitParts.push(finalBeforeSection);
    }
  } else {
    // Split routes with multiple points one point at a time.
    let currentTrack = trackPath;

    // 1. Segment before the first point.
    const firstPointSplit = lineSplit(currentTrack, pointsOnTrack[0]).features;
    if (firstPointSplit.length >= 1) {
      const beforeFirstSection = {
        ...firstPointSplit[0],
        geometry: {
          ...firstPointSplit[0].geometry,
          coordinates: firstPointSplit[0].geometry.coordinates.reverse(),
        },
      };
      const slicedBeforeFirst = lineSliceAlong(beforeFirstSection, 0, 20, {
        units: 'meters',
      });
      const finalBeforeFirst = {
        ...slicedBeforeFirst,
        geometry: {
          ...slicedBeforeFirst.geometry,
          coordinates: slicedBeforeFirst.geometry.coordinates.reverse(),
        },
      };
      splitParts.push(finalBeforeFirst);
    }

    // 2. Segments between the points.
    for (let i = 0; i < pointsOnTrack.length - 1; i++) {
      const currentSplit = lineSplit(currentTrack, pointsOnTrack[i]).features;
      if (currentSplit.length >= 2) {
        // Keep the part after the current point.
        const remainingTrack = currentSplit[1];
        const nextPointSplit = lineSplit(
          remainingTrack,
          pointsOnTrack[i + 1]
        ).features;
        if (nextPointSplit.length >= 1) {
          // Segment between the two points.
          splitParts.push(nextPointSplit[0]);
          // Use the remaining track for the next split.
          if (nextPointSplit.length >= 2) {
            currentTrack = nextPointSplit[1];
          }
        }
      }
    }

    // 3. Segment after the final point.
    const lastPointSplit = lineSplit(
      trackPath,
      pointsOnTrack[pointsOnTrack.length - 1]
    ).features;
    if (lastPointSplit.length >= 2) {
      const afterLastSection = lineSliceAlong(
        lastPointSplit[lastPointSplit.length - 1],
        0,
        20,
        { units: 'meters' }
      );
      splitParts.push(afterLastSection);
    }
  }

  const returnPath = {
    ...splitParts[0],
    geometry: {
      ...splitParts[0].geometry,
      coordinates: splitParts.flatMap(part => part.geometry.coordinates),
    },
  };
  return returnPath;
};
