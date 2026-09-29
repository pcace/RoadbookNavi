import { joinLegacyTrack } from '../../legacy-track';
import type { Project } from '../../model';
import { newProject } from '../../model';
import { loadLibrary, repository, routing, geocoder } from '../../services';
import { requireCoverage, extent } from '../../geometry';
import { generate } from '../../generate';
import {
  renderPdf,
  exportPdf,
  exportGpx,
  exportGeojson,
  saveRn2,
} from '../../export';
import { parseRoute } from '../../core/routeParser';
import { detectTurns } from '../../core/turnDetection';
import {
  editableWaypoints,
  samePoints,
  updateLocalProject,
} from '../../rn2-edit';
import { onlineSearch, onlineReverse } from '../../geocoding';
import type { FeatureCollection, LineString } from 'geojson';

export interface RouteRequestParams {
  routeId?: string;
  points: { lat: number; lon: number }[];
  profile?: string;
}

export type RoadbookProgressEvent =
  | {
      event: 'status';
      data: { message?: string; progress?: number; total?: number };
    }
  | {
      event: 'progress';
      data: {
        message?: string;
        current?: number;
        total?: number;
        percentage?: number;
      };
    }
  | { event: 'completed'; data: { success?: boolean; totalTurns?: number } };

export interface AddressSearchResult {
  id: number;
  lat: number;
  lon: number;
  displayName: string;
  address: Record<string, string | undefined>;
  type?: string;
  importance?: number;
}

export interface ReverseGeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  address: Record<string, string | undefined>;
}

const toRouteSummary = (p: Project) => ({
  id: p.id,
  name: p.name,
  waypoints: editableWaypoints(p),
  points: editableWaypoints(p),
  profile: p.profile,
  cached_brouterTrack_data: p.track,
  total_turns: p.entries.length,
  distance_m:
    p.track?.features.reduce(
      (sum, f) =>
        sum +
        Number(
          (f.properties as Record<string, unknown>)?.['length_m'] ??
            f.properties?.['track-length'] ??
            0
        ),
      0
    ) ?? null,
  created_at: p.updatedAt,
  updated_at: p.updatedAt,
});
export const findLocalProject = async (id: string) => {
  const local = (await repository.list()).find(p => p.id === id);
  if (local) return local;
  throw new Error('Die Route wurde nicht in der lokalen Bibliothek gefunden.');
};

export async function listLocalProjects() {
  return (await repository.list()).map(toRouteSummary);
}

export async function createLocalProject(input: {
  name: string;
  profile: string;
  waypoints?: { lat: number; lon: number }[];
  points?: { lat: number; lon: number }[];
  cached_brouterTrack_data?: FeatureCollection<LineString>;
}) {
  const project = {
    ...newProject(input.profile),
    name: input.name,
    waypoints: input.waypoints || input.points || [],
    track: (input.cached_brouterTrack_data as Project['track']) || null,
  };
  await repository.save(project);
  return toRouteSummary(project);
}

export async function updateLocalProjectSummary(
  id: string,
  changes: Record<string, unknown>
) {
  const project = updateLocalProject(await findLocalProject(id), changes);
  await repository.save(project);
  return toRouteSummary(project);
}

export async function deleteLocalProject(id: string) {
  await repository.remove(id);
}
export async function fetchBrouterRoute(
  params: RouteRequestParams,
  signal?: AbortSignal
) {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  if (params.routeId) {
    const found = await findLocalProject(params.routeId);
    const p = { ...found, track: joinLegacyTrack(found.track) };
    if (
      p.track &&
      samePoints(params.points, editableWaypoints(p)) &&
      (!params.profile || params.profile === p.profile)
    ) {
      return {
        routeData: p.track,
        routePoints: Array.isArray(p.track.features[0]?.properties?.messages)
          ? parseRoute(p.track)
          : [],
        totalDistance: Number(p.track.features[0].properties['track-length']),
        turnPoints: {
          type: 'FeatureCollection',
          features: p.entries.map((e, i) => ({
            type: 'Feature',
            properties: { index: i, id: e.turn.id, distance: e.distance },
            geometry: {
              type: 'Point',
              coordinates: [
                e.turn.points[0].longitude,
                e.turn.points[0].latitude,
              ],
            },
          })),
        },
      };
    }
  }
  const { regions } = await loadLibrary();
  requireCoverage(params.points, regions);
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const routeData = await routing.route(
    params.points,
    params.profile || 'trekking',
    ''
  );
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const routePoints = parseRoute(routeData),
    turns = detectTurns(routePoints);
  return {
    routeData,
    routePoints,
    totalDistance: Number(routeData.features[0].properties['track-length']),
    turnPoints: {
      type: 'FeatureCollection',
      features: turns.map((t, i) => ({
        type: 'Feature',
        properties: { index: i, id: t.id, distance: t.distanceFromStart },
        geometry: {
          type: 'Point',
          coordinates: [t.points[0].longitude, t.points[0].latitude],
        },
      })),
    },
  };
}
const inFlight = new Map<string, Promise<Project>>();
async function ready(id: string, onEvent?: (e: RoadbookProgressEvent) => void) {
  let p = await findLocalProject(id);
  if (p.entries.length) return p;
  let promise = inFlight.get(id);
  if (!promise) {
    promise = (async () => {
      const { regions } = await loadLibrary();
      p = await generate(
        p,
        regions,
        (message, progress, total) =>
          onEvent?.({ event: 'status', data: { message, progress, total } }),
        new AbortController().signal
      );
      await repository.save(p);
      return p;
    })();
    inFlight.set(id, promise);
  }
  try {
    return await promise;
  } finally {
    inFlight.delete(id);
  }
}
export async function generateRoadbookWithProgress(params: {
  routeId: string;
  profile?: string;
  onEvent?: (e: RoadbookProgressEvent) => void;
}) {
  const p = await ready(params.routeId, params.onEvent);
  params.onEvent?.({
    event: 'completed',
    data: { success: true, totalTurns: p.entries.length },
  });
}
export async function renderLocalRoadbook(
  _endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const body = JSON.parse(String(options.body || '{}')),
    p = await ready(body.routeId);
  if (body.exportType === 'pdf-index')
    return Response.json(
      p.entries.map((e, i) => ({
        index: i + 1,
        distance: e.distance,
        lat: e.turn.points[0].latitude,
        lng: e.turn.points[0].longitude,
      }))
    );
  const pdf = await renderPdf(
    p,
    body.exportType === 'pdf-roll'
      ? 'roll'
      : body.exportType === 'pdf-screen'
        ? 'screen'
        : 'a5'
  );
  if (
    pdf.length < 5 ||
    new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-'
  )
    throw new Error(
      'Die lokale PDF-Erzeugung hat keine gültige PDF-Datei geliefert.'
    );
  const pdfBody = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(pdfBody).set(pdf);
  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
    },
  });
}
export async function exportRoadbook(params: {
  routeId: string;
  exportType: string;
}) {
  const found = ['gpx', 'geojson'].includes(params.exportType)
    ? await findLocalProject(params.routeId)
    : await ready(params.routeId);
  const p = { ...found, track: joinLegacyTrack(found.track) };
  if (params.exportType === 'rn2') await saveRn2(p);
  else if (params.exportType === 'gpx') await exportGpx(p);
  else if (params.exportType === 'geojson') await exportGeojson(p);
  else if (params.exportType === 'pdf') await exportPdf(p, 'a5');
  else if (params.exportType === 'pdf-roll') await exportPdf(p, 'roll');
  else
    throw new Error(
      'Dieses Exportformat ist in RoadbookNavi noch nicht verfügbar.'
    );
}
export async function searchAddress(query: string, limit = 8) {
  const online = await onlineSearch(query);
  if (online?.length) return { query, results: online.slice(0, limit) };
  const features = await geocoder.search(query);
  return {
    query,
    results: features.slice(0, limit).map((f, i) => {
      const b = extent(f);
      return {
        id: i,
        lat: (b[1] + b[3]) / 2,
        lon: (b[0] + b[2]) / 2,
        displayName: f.properties?.name || query,
        address: {},
      };
    }),
  };
}
export async function reverseGeocode(lat: number, lon: number) {
  return (
    (await onlineReverse(lat, lon)) || {
      lat,
      lon,
      displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      address: {},
    }
  );
}
