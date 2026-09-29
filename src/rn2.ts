import { distance, bearing, point } from '@turf/turf';
import {
  readRn2,
  rn2Notes,
  rn2Preview,
  type Rn2Document,
} from './core/rn2/document';
import { buildRn2TransformContext } from './core/rn2/transforms';
import {
  buildBuildingElements,
  buildRoadElements,
  buildWaterwayElements,
  buildTrackFromTurnPath,
} from './core/rn2/elements';
import { clipTurnPath } from './core/clipTurnPath';
import { transformLineString } from './core/coordinateTransforms';
import { processOSMFeatures } from './core/roadbookUtils';
import { linearizeRn2Elements } from './core/rn2/curves';
import { newProject, validateProject, type Project } from './model';

export function importRn2(
  text: string,
  icon?: (e: Record<string, any>) => string | undefined
): Project {
  const rn2 = readRn2(text),
    ws = rn2.route.waypoints;
  const coords = ws.map(
    w =>
      [w.lon, w.lat, Number.isFinite(w.ele) ? w.ele : 0] as [
        number,
        number,
        number,
      ]
  );
  let total = 0;
  const entries: Project['entries'] = [];
  let inheritedType = rn2.route.settings?.defaultTrackType || 17;
  ws.forEach((w, i) => {
    if (i)
      total += distance(point(coords[i - 1]), point(coords[i]), {
        units: 'meters',
      });
    if (!w.show) return;
    const prev = ws[Math.max(0, i - 1)],
      next = ws[Math.min(ws.length - 1, i + 1)];
    const note = rn2Notes(w);
    const outgoing = bearing(
      point(coords[i]),
      point(coords[Math.min(ws.length - 1, i + 1)])
    );
    const incoming = bearing(
      point(coords[Math.max(0, i - 1)]),
      point(coords[i])
    );
    // At route boundaries one leg is missing. Its bearing is undefined, not
    // north: RN's default tulip is straight unless explicit geometry is stored.
    const headingChange =
      i === 0 || i === ws.length - 1 ? 0 : outgoing - incoming;
    const settings = {
      ...rn2.route.settings,
      current_style: rn2.route.current_style,
      defaultTrackType: inheritedType,
    };
    const track = w.tulip?.elements.find(e => e.type === 'Track');
    inheritedType =
      track?.roadOut?.typeId || track?.roadIn?.typeId || inheritedType;
    entries.push({
      distance: total,
      note,
      svg: rn2Preview(w, settings, icon, headingChange),
      rn2NotesSvg: rn2Preview({ ...w, tulip: w.notes }, settings, icon),
      rn2WaypointIndex: i,
      turn: {
        id: crypto.randomUUID(),
        instruction: note || `Eintrag ${entries.length + 1}`,
        angle: 0,
        distanceFromStart: total,
        bearing: (outgoing + 360) % 360,
        points: [
          {
            latitude: w.lat,
            longitude: w.lon,
            elevation: coords[i][2],
            prevPoint: { latitude: prev.lat, longitude: prev.lon },
            nextPoint: { latitude: next.lat, longitude: next.lon },
            distance: 0,
            totalDistance: total,
            time: 0,
            wayTags: '',
            nodeTags: '',
          },
        ],
      },
    });
  });
  return validateProject({
    ...newProject(),
    name: rn2.route.name,
    rn2Original: rn2,
    waypoints: ws
      .filter((w, i) => w.show || i === 0 || i === ws.length - 1)
      .map(w => ({ lat: w.lat, lon: w.lon })),
    entries,
    track: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {
            'track-length': total,
            'filtered ascend': 0,
            'plain-ascend': 0,
            'total-time': 0,
            'total-energy': 0,
            creator: 'Rally Navigator',
            messages: [],
          },
        },
      ],
    },
  });
}

export function tulipElements(entry: any) {
  const ctx = buildRn2TransformContext(entry);
  const track = buildTrackFromTurnPath(ctx.turnPath);
  return [
    ...buildBuildingElements(entry, ctx.toRn2Point),
    ...buildWaterwayElements(entry, ctx.toRn2Point),
    ...buildRoadElements(entry, ctx.toRn2Point),
    ...(track ? [track] : []),
  ];
}

export async function completeRn2Geometry(
  project: Project,
  featuresAt: (entry: Project['entries'][number]) => Promise<any[]>
): Promise<Project> {
  const complete = (e: Project['entries'][number]) =>
    e.rn2Elements !== undefined ||
    !!(project.rn2Source && e.rn2WaypointIndex !== undefined);
  if (project.rn2Original || project.entries.every(complete)) return project;
  const coords = project.track?.features[0]?.geometry.coordinates;
  if (!coords?.length) throw new Error('Der gespeicherte Track fehlt.');
  const coordinates = coords.map(c => [c[0], c[1]] as [number, number]);
  const entries: Project['entries'] = [];
  for (const entry of project.entries) {
    if (complete(entry)) {
      entries.push(entry);
      continue;
    }
    const features = await featuresAt(entry);
    const p = entry.turn.points[0];
    const context = {
      centerLat: p.latitude,
      centerLon: p.longitude,
      pixelsPerMeter: 1,
    };
    const clipped = clipTurnPath(coordinates, entry.turn);
    const rn2Elements = tulipElements({
      turn: entry.turn,
      turnPath: transformLineString(
        (clipped?.geometry.coordinates || []) as [number, number][],
        context
      ),
      ...processOSMFeatures(features, context),
    });
    entries.push({ ...entry, rn2Elements, rn2GeometryVersion: 2 });
  }
  return {
    ...project,
    entries,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function exportRn2(project: Project): Rn2Document {
  if (project.rn2Original) {
    // The app has no RN2 element editor yet. Preserve every original field,
    // including icons, smart tags, units and the embedded header image.
    const original = structuredClone(project.rn2Original);
    original.route.name = project.name;
    return original;
  }
  const coords = project.track?.features[0]?.geometry.coordinates;
  if (!coords?.length || !project.entries.length)
    throw new Error('Zuerst ein Roadbook erzeugen.');
  const entryAt = new Map<number, Project['entries'][number]>();
  let cursor = 0;
  for (const entry of project.entries) {
    const p = entry.turn.points[0];
    let best = cursor,
      min = Infinity;
    for (let i = cursor; i < coords.length; i++) {
      const delta =
        (coords[i][0] - p.longitude) ** 2 + (coords[i][1] - p.latitude) ** 2;
      if (delta < min) {
        min = delta;
        best = i;
      }
      if (delta < 1e-16) break;
    }
    if (min > 1e-10 || entryAt.has(best))
      throw new Error(
        'Roadbook-Einträge passen nicht eindeutig zum Track. Bitte das Roadbook neu erzeugen.'
      );
    entryAt.set(best, entry);
    cursor = best + 1;
  }
  const waypoints = coords.map((c, i) => {
    const e = entryAt.get(i);
    const original =
      e?.rn2WaypointIndex !== undefined
        ? project.rn2Source?.route.waypoints[e.rn2WaypointIndex]
        : undefined;
    if (original)
      return {
        ...structuredClone(original),
        waypointid: i,
        lat: c[1],
        lon: c[0],
        ele: c[2] || 0,
        show: true,
      };
    const elements = e?.rn2Elements
      ? e.rn2GeometryVersion === 2
        ? e.rn2Elements
        : linearizeRn2Elements(e.rn2Elements)
      : undefined;
    if (e && !elements) {
      throw new Error(
        'RN2-Geometrien fehlen. Bitte den Export über den Speicherdialog starten, damit die lokalen Gebietsdaten ergänzt werden.'
      );
    }
    return {
      waypointid: i,
      lat: c[1],
      lon: c[0],
      ele: c[2] || 0,
      show: !!e,
      showCoordinates: false,
      showHeading: !!e,
      showStickMarkOnTulip: false,
      tulip: { elements: elements || [] },
      notes: {
        elements: e?.note
          ? [
              {
                type: 'Text',
                text: e.note,
                x: 99.5,
                y: 85,
                width: 180,
                fontSize: 18,
                eId: crypto.randomUUID(),
              },
            ]
          : [],
      },
      overridenSmartTags: { dataType: 'Map', value: [] },
    };
  });
  return {
    route: {
      version: 4,
      name: project.name,
      description: 'Created with RoadbookNavi',
      current_style: project.rn2Source?.route.current_style || 'cross_country',
      settings: project.rn2Source?.route.settings || {
        units: 'metric',
        showHeadings: true,
        defaultTrackType: 4,
      },
      waypoints,
    },
  };
}
