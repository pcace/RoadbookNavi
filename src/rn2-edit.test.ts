import { describe, it, expect } from 'vitest';
import { importRn2, exportRn2, completeRn2Geometry } from './rn2';
import {
  editableWaypoints,
  updateLocalProject,
  retainedRn2Entries,
} from './rn2-edit';

function fixture() {
  return {
    route: {
      version: 4,
      name: 'Editable',
      settings: { trackColor: 1 },
      waypoints: Array.from({ length: 9 }, (_, i) => ({
        waypointid: i,
        lat: 50,
        lon: 10 + i * 0.002,
        show: i % 2 === 0,
        tulip: {
          elements: [
            { type: 'Track', roadIn: {}, roadOut: {} },
            { type: 'Icon', name: 'Custom', src: '/icons/custom.svg' },
          ],
        },
        notes: { elements: [{ type: 'Text', text: `Note ${i}` }] },
      })),
    },
  };
}

describe('Editing imported RN2', () => {
  it('exposes every visible entry, including old start/finish-only projects', () => {
    const p = importRn2(JSON.stringify(fixture()));
    expect(p.waypoints).toHaveLength(5);
    p.waypoints = [p.waypoints[0], p.waypoints.at(-1)!];
    expect(editableWaypoints(p)).toHaveLength(5);
    const renamed = updateLocalProject(p, {
      name: 'Renamed',
      waypoints: editableWaypoints(p),
    });
    expect(renamed.entries).toHaveLength(5);
    expect(renamed.rn2Original).toBe(p.rn2Original);
  });
  it('preserves original artwork outside an edited section and drops changed approaches', async () => {
    const p = importRn2(JSON.stringify(fixture())),
      track = structuredClone(p.track!);
    track.features[0].geometry.coordinates[3][1] += 0.001;
    const edited = updateLocalProject(p, { cached_brouterTrack_data: track });
    expect(edited.rn2Original).toBeUndefined();
    expect(edited.rn2Source).toBe(p.rn2Original);
    expect(edited.entries).toEqual([]);
    const kept = retainedRn2Entries(edited, track);
    expect(kept.map(e => e.rn2WaypointIndex)).toEqual([0, 6, 8]);
    expect(kept[1].distance).toBeGreaterThan(p.entries[3].distance);
    edited.entries = kept;
    expect(
      await completeRn2Geometry(edited, async () => {
        throw new Error('must not regenerate original art');
      })
    ).toBe(edited);
    const out = exportRn2(edited);
    expect(out.route.waypoints[6].tulip).toEqual(
      p.rn2Original!.route.waypoints[6].tulip
    );
    expect(out.route.waypoints[6].notes).toEqual(
      p.rn2Original!.route.waypoints[6].notes
    );
    expect(out.route.settings.trackColor).toBe(1);
    const again = updateLocalProject(edited, {
      waypoints: [edited.waypoints[0], edited.waypoints.at(-1)!],
    });
    expect(again.rn2Source).toBe(edited.rn2Source);
    expect(again.track).toBeNull();
  });
  it('drops artwork when the point moves or route direction reverses', () => {
    const p = importRn2(JSON.stringify(fixture())),
      track = structuredClone(p.track!);
    track.features[0].geometry.coordinates[4][1] += 0.001;
    expect(
      retainedRn2Entries({ ...p, rn2Source: p.rn2Original }, track).some(
        e => e.rn2WaypointIndex === 4
      )
    ).toBe(false);
    track.features[0].geometry.coordinates.reverse();
    expect(
      retainedRn2Entries({ ...p, rn2Source: p.rn2Original }, track)
    ).toHaveLength(0);
  });
});
