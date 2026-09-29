import { parseRoute } from './core/routeParser';
import { detectTurns } from './core/turnDetection';
import { filterTurns, processOSMFeatures } from './core/roadbookUtils';
import { clipTurnPath } from './core/clipTurnPath';
import { transformLineString } from './core/coordinateTransforms';
import { generateTurnSVG } from './core/svgGenerator';
import { tulipElements } from './rn2';
self.onmessage = ({ data }) => {
  try {
    if (data.op === 'parse') {
      const turns = filterTurns(detectTurns(parseRoute(data.track)), 5);
      self.postMessage({ id: data.id, result: turns });
    } else {
      const { turn, coordinates, features } = data;
      const p = turn.points[0];
      const context = {
        centerLat: p.latitude,
        centerLon: p.longitude,
        pixelsPerMeter: 1,
      };
      const clipped = clipTurnPath(
        coordinates.map((c: number[]) => [c[0], c[1]]),
        turn
      );
      const entry = {
        turn,
        turnPath: transformLineString(
          (clipped?.geometry.coordinates || []) as [number, number][],
          context
        ),
        ...processOSMFeatures(features, context),
      };
      self.postMessage({
        id: data.id,
        result: {
          svg: generateTurnSVG(entry, 300, 200),
          rn2Elements: tulipElements(entry),
          rn2GeometryVersion: 2,
        },
      });
    }
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e) });
  }
};
