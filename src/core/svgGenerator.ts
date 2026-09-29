/**
 * SVG Generation for Roadbook Entries
 * Generates SVG representations of roadbook turns similar to the web display
 */
import { TulipColors } from './tulipColors';

interface Point {
  x: number;
  y: number;
}

interface Highway {
  coords: Point[];
  type: string;
}

interface TurnPath {
  x: number;
  y: number;
}

interface RoadbookEntryData {
  turn: any;
  turnPath?: TurnPath[];
  highways?: Highway[];
  buildings?: Point[][];
  waterways?: Point[][];
  railways?: Point[][];
  powerLines?: Point[][];
  naturalWater?: Point[][];
}

/**
 * Calculates the rotation angle from the turn path
 */
function calculateRotation(turnPath: TurnPath[]): number {
  if (!turnPath || turnPath.length < 2) {
    return 0;
  }

  const p1 = turnPath[0];
  const p2 = turnPath[1];
  const deltaX = p2.x - p1.x;
  const deltaY = p2.y - p1.y;

  // Calculate angle in degrees (SVG uses degrees)
  const angleRad = Math.atan2(deltaY, deltaX);
  const angleDeg = (angleRad * 180) / Math.PI;

  // Adjust so that 0° points up (north)
  return 90 - angleDeg;
}

/**
 * Calculates the center point of the turn path
 * Uses the 0,0 point from the turn path as center
 */
function calculateTurnPathCenter(turnPath: TurnPath[]): {
  x: number;
  y: number;
} {
  if (!turnPath || turnPath.length === 0) {
    return { x: 0, y: 0 };
  }

  // Find the 0,0 point in the turn path
  const zeroPoint = turnPath.find(p => p.x === 0 && p.y === 0);
  if (zeroPoint) {
    return { x: 0, y: 0 };
  }

  // Fallback to second point if no 0,0 found
  if (turnPath.length >= 2) {
    return {
      x: turnPath[1].x,
      y: turnPath[1].y,
    };
  }

  // Fallback to first point if only one point exists
  return {
    x: turnPath[0].x,
    y: turnPath[0].y,
  };
}

/**
 * Scales coordinates around a center point
 * @param points Array of points to scale
 * @param center Center point for scaling
 * @param scaleFactor Zoom factor (>1 = zoom in, <1 = zoom out)
 */
function scaleCoordinates(
  points: Point[],
  center: { x: number; y: number },
  scaleFactor: number
): Point[] {
  return points.map(point => ({
    x: center.x + (point.x - center.x) * scaleFactor,
    y: center.y + (point.y - center.y) * scaleFactor,
  }));
}

/**
 * Converts a path of points to SVG path data
 */
function pointsToPathData(points: Point[]): string {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

/**
 * Converts a closed polygon to SVG path data
 */
function polygonToPathData(points: Point[]): string {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ' Z'; // Close the path
  return path;
}

/**
 * Check if highway should be rendered as dashed line
 */
function isDashed(type: string): boolean {
  return ['track', 'path', 'footway', 'cycleway', 'pedestrian'].includes(type);
}

/**
 * Check if highway should be rendered as double line
 */
function isDoubleLine(type: string): boolean {
  return [
    'motorway',
    'motorway_link',
    'trunk',
    'trunk_link',
    'primary',
    'primary_link',
  ].includes(type);
}

/**
 * Gets the stroke width and color for different highway types
 * Matching frontend styling from highwayUtils.ts
 */
function getHighwayStyle(type: string): {
  strokeWidth: number;
  stroke: string;
} {
  const styles: Record<string, { strokeWidth: number; stroke: string }> = {
    // Major roads use a double line.
    motorway: { strokeWidth: 2.5, stroke: '#000000' },
    motorway_link: { strokeWidth: 2.5, stroke: '#000000' },
    trunk: { strokeWidth: 2.5, stroke: '#000000' },
    trunk_link: { strokeWidth: 2.2, stroke: '#000000' },
    primary: { strokeWidth: 2.5, stroke: '#000000' },
    primary_link: { strokeWidth: 2.2, stroke: '#000000' },

    // Medium-sized roads.
    secondary: { strokeWidth: 4.0, stroke: '#000000' },
    secondary_link: { strokeWidth: 3.5, stroke: '#000000' },
    tertiary: { strokeWidth: 3.5, stroke: '#000000' },
    tertiary_link: { strokeWidth: 3.0, stroke: '#000000' },

    // Minor roads.
    residential: { strokeWidth: 3.0, stroke: '#000000' },
    unclassified: { strokeWidth: 3.0, stroke: '#000000' },
    service: { strokeWidth: 2.5, stroke: '#000000' },

    // Paths and tracks use dashed lines.
    track: { strokeWidth: 2.5, stroke: '#000000' },
    path: { strokeWidth: 2.5, stroke: '#000000' },
    footway: { strokeWidth: 2.5, stroke: '#000000' },
    cycleway: { strokeWidth: 2.5, stroke: '#000000' },
    pedestrian: { strokeWidth: 2.5, stroke: '#000000' },

    default: { strokeWidth: 2.5, stroke: '#000000' },
  };

  return styles[type] || styles.default;
}

/**
 * Generates SVG for a roadbook turn
 */
export function generateTurnSVG(
  entry: RoadbookEntryData,
  width: number = 240,
  height: number = 120,
  zoomFactor: number = 0.8,
  yOffset: number = 5,
  lineWidthFactor: number = 0.7
): string {
  const rotation = calculateRotation(entry.turnPath || []);
  const centerX = width / 2;
  const centerY = height / 2;
  // Calculate the center of the turn path
  const turnPathCenter = calculateTurnPathCenter(entry.turnPath || []);

  // Apply zoom to all coordinates
  const zoomedEntry: RoadbookEntryData = {
    ...entry,
    turnPath: entry.turnPath
      ? scaleCoordinates(entry.turnPath, turnPathCenter, zoomFactor)
      : undefined,
    highways: entry.highways?.map(h => ({
      ...h,
      coords: scaleCoordinates(h.coords, turnPathCenter, zoomFactor),
    })),
    buildings: entry.buildings?.map(b =>
      scaleCoordinates(b, turnPathCenter, zoomFactor)
    ),
    waterways: entry.waterways?.map(w =>
      scaleCoordinates(w, turnPathCenter, zoomFactor)
    ),
    railways: entry.railways?.map(r =>
      scaleCoordinates(r, turnPathCenter, zoomFactor)
    ),
    powerLines: entry.powerLines?.map(p =>
      scaleCoordinates(p, turnPathCenter, zoomFactor)
    ),
    naturalWater: entry.naturalWater?.map(n =>
      scaleCoordinates(n, turnPathCenter, zoomFactor)
    ),
  };

  // SVG container with rotation applied
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Define arrow marker for turn path
  svg += `<defs>`;
  svg += `<marker id="arrow" markerWidth="${30 * lineWidthFactor}" markerHeight="${30 * lineWidthFactor}" refX="0" refY="${15 * lineWidthFactor}" orient="auto" markerUnits="userSpaceOnUse">`;
  svg += `<path d="M0,0 L0,${30 * lineWidthFactor} L${20 * lineWidthFactor},${15 * lineWidthFactor} z" fill="${TulipColors.turnPath}" fill-opacity="0.8" />`;
  svg += `</marker>`;
  svg += `</defs>`;

  // Draw the background outside the transform group.
  // svg += `<rect width="${width}" height="${height}" fill="#f5f5f5"/>`;

  // Rotate around the turn-path centre, then translate to the image centre.
  svg += `<g transform="translate(${centerX}, ${centerY + yOffset}) rotate(${rotation + 180}) translate(${-turnPathCenter.x}, ${-turnPathCenter.y})">`;

  // Draw natural water (if any)
  if (zoomedEntry.naturalWater && zoomedEntry.naturalWater.length > 0) {
    zoomedEntry.naturalWater.forEach(polygon => {
      const pathData = polygonToPathData(polygon);
      if (pathData) {
        svg += `<path d="${pathData}" fill="${TulipColors.naturalWater}" stroke="${TulipColors.naturalWater}" stroke-width="${1 * lineWidthFactor}"/>`;
      }
    });
  }

  // Draw waterways
  if (zoomedEntry.waterways && zoomedEntry.waterways.length > 0) {
    zoomedEntry.waterways.forEach(waterway => {
      const pathData = pointsToPathData(waterway);
      if (pathData) {
        svg += `<path d="${pathData}" stroke="${TulipColors.waterway}" stroke-width="${1.0 * lineWidthFactor}" fill="none"/>`;
      }
    });
  }

  // Draw buildings
  if (zoomedEntry.buildings && zoomedEntry.buildings.length > 0) {
    zoomedEntry.buildings.forEach(building => {
      const pathData = polygonToPathData(building);
      if (pathData) {
        svg += `<path d="${pathData}" fill="${TulipColors.buildingFill}" stroke="${TulipColors.buildingStroke}" stroke-width="${0.5 * lineWidthFactor}"/>`;
      }
    });
  }

  // Draw railways
  if (zoomedEntry.railways && zoomedEntry.railways.length > 0) {
    zoomedEntry.railways.forEach(railway => {
      const pathData = pointsToPathData(railway);
      if (pathData) {
        svg += `<path d="${pathData}" stroke="${TulipColors.railway}" stroke-width="${0.5 * lineWidthFactor}" stroke-dasharray="3,3" fill="none"/>`;
      }
    });
  }

  // Draw power lines
  if (zoomedEntry.powerLines && zoomedEntry.powerLines.length > 0) {
    zoomedEntry.powerLines.forEach(powerLine => {
      const pathData = pointsToPathData(powerLine);
      if (pathData) {
        svg += `<path d="${pathData}" stroke="${TulipColors.powerLine}" stroke-width="${0.5 * lineWidthFactor}" stroke-dasharray="2,2" fill="none"/>`;
      }
    });
  }

  // Draw highways (roads)
  if (zoomedEntry.highways && zoomedEntry.highways.length > 0) {
    // Sort highways by stroke width (draw wider roads first)
    const sortedHighways = [...zoomedEntry.highways].sort((a, b) => {
      const styleA = getHighwayStyle(a.type);
      const styleB = getHighwayStyle(b.type);
      return styleB.strokeWidth - styleA.strokeWidth;
    });

    sortedHighways.forEach(highway => {
      const pathData = pointsToPathData(highway.coords);
      const style = getHighwayStyle(highway.type);
      const dashed = isDashed(highway.type);
      const doubleLine = isDoubleLine(highway.type);

      if (pathData) {
        if (doubleLine) {
          // Draw double line for major roads
          const outerWidth = (style.strokeWidth + 0.8) * lineWidthFactor;
          svg += `<path d="${pathData}" stroke="${TulipColors.majorRoadOuter}" stroke-width="${outerWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
          svg += `<path d="${pathData}" stroke="${TulipColors.majorRoadInner}" stroke-width="${style.strokeWidth * 0.3 * lineWidthFactor}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        } else if (dashed) {
          // Draw dashed line for paths and tracks
          svg += `<path d="${pathData}" stroke="${TulipColors.highwayBase}" stroke-width="${style.strokeWidth * lineWidthFactor}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,4" fill="none"/>`;
        } else {
          // Draw normal road
          svg += `<path d="${pathData}" stroke="${TulipColors.highwayBase}" stroke-width="${style.strokeWidth * lineWidthFactor}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        }
      }
    });
  }

  // Draw turn path (highlighted route)
  if (zoomedEntry.turnPath && zoomedEntry.turnPath.length > 0) {
    const pathData = pointsToPathData(zoomedEntry.turnPath);
    if (pathData) {
      // Highlight the turn path with arrow at the end
      svg += `<path d="${pathData}" stroke="${TulipColors.turnPath}" stroke-width="${10 * lineWidthFactor}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.8" marker-end="url(#arrow)"/>`;
    }
  }

  // Close the rotation group
  svg += '</g>';

  // Add indicator at 0,0 points in turn path (outside transform group for fixed 45° angle)
  if (zoomedEntry.turnPath && zoomedEntry.turnPath.length > 0) {
    // Find all 0,0 points
    const zeroPoints = zoomedEntry.turnPath.filter(p => p.x === 0 && p.y === 0);

    if (zeroPoints.length > 0) {
      // Transform the 0,0 point to final image coordinates
      // Apply same transformation as the group: translate, rotate, translate back
      const rotRad = ((rotation + 180) * Math.PI) / 180;

      zeroPoints.forEach(point => {
        // Apply transformations in order
        let x = point.x - turnPathCenter.x;
        let y = point.y - turnPathCenter.y;

        // Rotate
        const xRot = x * Math.cos(rotRad) - y * Math.sin(rotRad);
        const yRot = x * Math.sin(rotRad) + y * Math.cos(rotRad);

        // Translate to center
        const finalX = xRot + centerX;
        const finalY = yRot + centerY + yOffset;

        // Draw indicator at 45° in final image coordinates
        const indicatorLength = 15;
        const endX = finalX + indicatorLength * Math.cos(Math.PI / 4);
        const endY = finalY + indicatorLength * Math.sin(Math.PI / 4);

        // Draw line
        svg += `<line x1="${finalX}" y1="${finalY}" x2="${endX}" y2="${endY}" stroke="${TulipColors.turnIndicator}" stroke-width="${2 * lineWidthFactor}"/>`;

        // Draw circle at end
        svg += `<circle cx="${endX}" cy="${endY}" r="${3 * lineWidthFactor}" fill="${TulipColors.turnIndicator}"/>`;
      });
    }
  }

  svg += '</svg>';

  return svg;
}

/**
 * Generates a simple placeholder SVG when turn data is not available
 */
export function generatePlaceholderSVG(
  width: number = 240,
  height: number = 120
): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#f5f5f5"/>
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#999999" font-size="14" font-family="Arial">
            Berechnung...
        </text>
    </svg>`;
}
