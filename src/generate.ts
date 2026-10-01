import type { Project, Entry } from './model';
import type { BRouterGeoJSON, Turn } from './core/types';
import { osm, routing } from './services';
import { detailBounds } from './geometry';
import { retainedRn2Entries } from './rn2-edit';
import { prefetchOpenFreeMap } from './openFreeMap';

export async function generate(
  project: Project,
  progress: (text: string, progress?: number, total?: number) => void,
  signal: AbortSignal
): Promise<Project> {
  if (project.waypoints.length < 2)
    throw new Error('Mindestens zwei Wegpunkte setzen.');
  const check = () => {
    if (signal.aborted) throw new Error('Abgebrochen');
  };
  check();
  progress('Route lokal berechnen …');
  check();
  const track = Array.isArray(project.track?.features[0]?.properties?.messages)
    ? project.track
    : await routing.route(project.waypoints, project.profile, '');
  const coords = track.features[0]?.geometry.coordinates;
  if (!coords?.length) throw new Error('BRouter hat keine Route geliefert.');
  check();
  const worker = new Worker(new URL('./roadbook.worker.ts', import.meta.url), {
    type: 'module',
  });
  let id = 0;
  const ask = <T>(body: object) =>
    new Promise<T>((resolve, reject) => {
      const request = ++id;
      const cancel = () => {
        cleanup();
        reject(new Error('Abgebrochen'));
      };
      const message = (event: MessageEvent) => {
        if (event.data.id !== request) return;
        cleanup();
        event.data.error
          ? reject(new Error(event.data.error))
          : resolve(event.data.result);
      };
      const failure = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(e.message));
      };
      const cleanup = () => {
        worker.removeEventListener('message', message);
        worker.removeEventListener('error', failure);
        signal.removeEventListener('abort', cancel);
      };
      worker.addEventListener('message', message);
      worker.addEventListener('error', failure);
      signal.addEventListener('abort', cancel, { once: true });
      worker.postMessage({ ...body, id: request });
    });
  try {
    const turns = await ask<Turn[]>({
      op: 'parse',
      track: track as BRouterGeoJSON,
    });
    const preserved = retainedRn2Entries(project, track);
    const entries: Entry[] = [...preserved];
    const pendingTurns = turns.filter(
      turn =>
        !preserved.some(
          entry => Math.abs(entry.distance - turn.distanceFromStart) < 10
        )
    );
    await prefetchOpenFreeMap(
      pendingTurns.map(turn =>
        detailBounds({
          lat: turn.points[0].latitude,
          lon: turn.points[0].longitude,
        })
      ),
      (current, total) => progress('Kartendaten laden …', current, total),
      signal
    );
    for (let i = 0; i < turns.length; i++) {
      check();
      progress(
        `Kreuzungszeichnung ${i + 1} von ${turns.length}`,
        i + 1,
        turns.length
      );
      const turn = turns[i],
        p = { lat: turn.points[0].latitude, lon: turn.points[0].longitude };
      if (
        preserved.some(e => Math.abs(e.distance - turn.distanceFromStart) < 10)
      )
        continue;
      const bounds = detailBounds(p);
      const data = await osm.query(bounds, 'detail');
      check();
      const drawing = await ask<{
        svg: string;
        rn2Elements: Record<string, any>[];
        rn2GeometryVersion: number;
      }>({ op: 'entry', turn, coordinates: coords, features: data.features });
      entries.push({
        turn,
        distance: turn.distanceFromStart,
        ...drawing,
        note: '',
      });
    }
    entries.sort((a, b) => a.distance - b.distance);
    return {
      ...project,
      track,
      entries,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    worker.terminate();
  }
}
