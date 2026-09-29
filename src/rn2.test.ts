import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { importRn2, exportRn2, completeRn2Geometry } from './rn2';
import { readRn2 } from './core/rn2/document';
import { rn2Preview } from './core/rn2/document';
import {
  sampleRn2Curve,
  polylineHandles,
  linearizeRn2Elements,
} from './core/rn2/curves';

const fixture = () => ({
  route: {
    version: 4,
    name: 'Test',
    settings: { units: 'imperial' },
    futureField: { value: 42 },
    waypoints: [
      {
        waypointid: 0,
        lat: 50,
        lon: 10,
        show: true,
        tulip: {
          elements: [
            {
              type: 'Track',
              roadIn: { end: { x: 0, y: 50 } },
              roadOut: { end: { x: 40, y: -30 } },
            },
            {
              type: 'Icon',
              name: '<script>alert(1)</script>',
              src: 'https://example.invalid/icon.svg',
              x: 50,
              y: 30,
            },
          ],
        },
        notes: { elements: [{ type: 'Text', text: 'Start & links' }] },
      },
      { waypointid: 1, lat: 50, lon: 10.01, show: false },
      {
        waypointid: 2,
        lat: 50.01,
        lon: 10.01,
        show: true,
        notes: { elements: [{ type: 'Text', text: 'Ziel' }] },
      },
    ],
  },
});

describe('RN2 exchange', () => {
  it('renders default start/finish tracks straight while retaining interior turns and explicit geometry', () => {
    const source = {
      route: {
        version: 4,
        name: 'Boundary defaults',
        settings: { tulipLoweredLayout: true },
        waypoints: [
          { waypointid: 0, lat: 32.81, lon: -114.85, show: true },
          { waypointid: 1, lat: 32.83, lon: -114.86, show: true },
          { waypointid: 2, lat: 32.84, lon: -114.85, show: true },
        ].map(w => ({
          ...w,
          tulip: {
            elements: [
              {
                type: 'Track',
                roadIn: { handles: [] },
                roadOut: { handles: [] },
              },
            ],
          },
        })),
      },
    };
    const imported = importRn2(JSON.stringify(source));
    for (const index of [0, 2])
      expect(imported.entries[index].svg).toBe(
        rn2Preview(source.route.waypoints[index], source.route.settings)
      );
    expect(imported.entries[1].svg).not.toBe(
      rn2Preview(source.route.waypoints[1], source.route.settings)
    );
    expect(exportRn2(imported)).toEqual(source);
    const custom = fixture(),
      project = importRn2(JSON.stringify(custom));
    expect(project.entries[0].svg).toContain('translate(139.5 54)');
  });
  it.skipIf(!process.env.RN2_BOUNDARY_FILE)(
    'renders test4 start and finish like RN default straight tulips',
    () => {
      const text = readFileSync(process.env.RN2_BOUNDARY_FILE!, 'utf8');
      const source = readRn2(text),
        project = importRn2(text);
      expect(project.entries).toHaveLength(3);
      for (const index of [0, 2])
        expect(project.entries[index].svg).toBe(
          rn2Preview(source.route.waypoints[index], {
            ...source.route.settings,
            current_style: source.route.current_style,
          })
        );
      expect(exportRn2(project)).toEqual(source);
    }
  );
  it('uses the absolute RN anchor for both incoming and curved outgoing roads', () => {
    const svg = rn2Preview(
      {
        waypointid: 1,
        lat: 0,
        lon: 0,
        show: true,
        tulip: {
          elements: [
            {
              type: 'Track',
              roadIn: {},
              roadOut: {
                start: { x: 92, y: 66 },
                end: { x: -5, y: -41 },
                handles: [
                  { x: 2, y: -13 },
                  { x: -5, y: -27 },
                ],
              },
            },
          ],
        },
      },
      { trackColor: 0, defaultTrackType: 2 }
    );
    expect(svg).toContain('points="92,66 ');
    expect(svg).toContain('92,106');
    expect(svg).toContain('87,25');
    expect(svg).toContain('fill="blue"');
    expect(svg).toContain('stroke-dasharray="5 10"');
    expect(svg).not.toContain('192,151');
  });
  it('interpolates curves smoothly through the endpoints', () => {
    const p = sampleRn2Curve(
      [
        { x: 0, y: 0 },
        { x: 15, y: -10 },
        { x: 5, y: -30 },
      ],
      120
    );
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p.at(-1)).toEqual({ x: 5, y: -30 });
    expect(p.every(v => Number.isFinite(v.x) && Number.isFinite(v.y))).toBe(
      true
    );
    expect(
      sampleRn2Curve([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 40 },
      ]).at(-1)
    ).toEqual({ x: 0, y: 40 });
  });
  it('keeps the test3 incoming kink close to the original polyline after RN smoothing', () => {
    const corner = { x: -27.7040795471751, y: 0.6433033564868325 },
      end = { x: -27.704079552129222, y: 22.06694232344296 };
    const start = { x: 0, y: 0 };
    const sampled = sampleRn2Curve([
      start,
      ...polylineHandles(start, [corner], end),
      end,
    ]);
    const dist = (p: any, a: any, b: any) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
          )
        );
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    expect(
      Math.max(
        ...sampled.map(p =>
          Math.min(dist(p, start, corner), dist(p, corner, end))
        )
      )
    ).toBeLessThan(0.5);
    const roads = linearizeRn2Elements([
      { type: 'Road', start, handles: [corner], end, typeId: 8 },
    ]);
    expect(roads).toHaveLength(2);
    expect(roads[0].path).toEqual([
      ['M', 100, 85],
      ['L', corner.x + 100, corner.y + 85],
      ['L', end.x + 100, end.y + 85],
    ]);
  });
  it('upgrades older SVG-only roadbooks with buildings, side roads and waterways', async () => {
    const p = importRn2(JSON.stringify(fixture()));
    delete p.rn2Original;
    p.entries[0].turn.id = 'start';
    p.entries[1].turn.id = 'finish';
    expect(() => exportRn2(p)).toThrow('RN2-Geometrien fehlen');
    const upgraded = await completeRn2Geometry(p, async e => {
      const { longitude: x, latitude: y } = e.turn.points[0];
      return [
        {
          type: 'Feature',
          properties: { building: 'yes' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [x, y],
                [x + 0.0001, y],
                [x + 0.0001, y + 0.0001],
                [x, y + 0.0001],
                [x, y],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { highway: 'residential' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [x - 0.0001, y],
              [x + 0.0001, y],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { waterway: 'stream' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [x, y - 0.0001],
              [x, y + 0.0001],
            ],
          },
        },
      ];
    });
    expect(upgraded.track).toBe(p.track);
    expect(p.entries[0].rn2Elements).toBeUndefined();
    const output = exportRn2(upgraded);
    for (const w of output.route.waypoints.filter(w => w.show)) {
      const es = w.tulip!.elements;
      expect(es.some(e => e.type === 'Line' && e.stroke === 'black')).toBe(
        true
      );
      expect(es.some(e => e.type === 'Line' && e.stroke === '#636363ff')).toBe(
        true
      );
      expect(es.some(e => e.type === 'Line' && e.stroke === '#A9D3EF')).toBe(
        true
      );
      expect(es.some(e => e.type === 'Track')).toBe(true);
    }
    expect(
      await completeRn2Geometry(upgraded, async () => {
        throw new Error('must not refetch');
      })
    ).toBe(upgraded);
  });
  it('does not mutate the original when local geometry is unavailable', async () => {
    const p = importRn2(JSON.stringify(fixture()));
    delete p.rn2Original;
    await expect(
      completeRn2Geometry(p, async () => {
        throw new Error('Gebiet fehlt');
      })
    ).rejects.toThrow('Gebiet fehlt');
    expect(p.entries.every(e => e.rn2Elements === undefined)).toBe(true);
  });
  it.skipIf(!process.env.RN2_REFERENCE_FILE)(
    'preserves all structures in the web-exported reference',
    () => {
      const text = readFileSync(process.env.RN2_REFERENCE_FILE!, 'utf8');
      const output = exportRn2(importRn2(text));
      expect(output).toEqual(JSON.parse(text));
      const es = output.route.waypoints.flatMap(w => w.tulip?.elements || []);
      expect(es.filter(e => e.type === 'Line')).toHaveLength(1060);
      expect(es.filter(e => e.type === 'Road')).toHaveLength(8023);
      expect(es.filter(e => e.type === 'Track')).toHaveLength(237);
    }
  );
  it('preserves the entire original document on import/export, with a fresh local ID', () => {
    const source = fixture(),
      a = importRn2(JSON.stringify(source)),
      b = importRn2(JSON.stringify(source));
    expect(a.id).not.toBe(b.id);
    expect(a.entries).toHaveLength(2);
    expect(a.track?.features[0].geometry.coordinates).toHaveLength(3);
    expect(a.entries[1].distance).toBeGreaterThan(1800);
    expect(exportRn2(a)).toEqual(source);
    a.name = 'Renamed';
    expect(exportRn2(a).route.name).toBe('Renamed');
    expect(source.route.name).toBe('Test');
  });
  it('does not fetch external icons or inject markup into the preview', () => {
    const p = importRn2(JSON.stringify(fixture()));
    expect(p.entries[0].svg).not.toContain('<script>');
    expect(p.entries[0].svg).not.toContain('https://');
    expect(p.entries[0].svg).toContain('&lt;script&gt;');
    expect(p.entries[0].note).toBe('Start & links');
  });
  it('exports native geometry and notes as standard RN2 elements', () => {
    const p = importRn2(JSON.stringify(fixture()));
    delete p.rn2Original;
    p.entries.forEach(e => {
      e.rn2Elements = [
        {
          type: 'Track',
          roadIn: {},
          roadOut: { end: { x: 20, y: -30 } },
          eId: 'test',
        },
      ];
    });
    const output = exportRn2(p);
    expect(
      readRn2(JSON.stringify(output)).route.waypoints.map(w => w.show)
    ).toEqual([true, false, true]);
    expect(output.route.waypoints[0].tulip?.elements[0].type).toBe('Track');
    expect(importRn2(JSON.stringify(output)).entries[1].note).toBe('Ziel');
  });
  it('rejects unsupported versions, bad coordinates, duplicate IDs and empty roadbooks', () => {
    for (const change of [
      (x: any) => (x.route.version = 3),
      (x: any) => (x.route.waypoints[0].lat = 91),
      (x: any) => (x.route.waypoints[1].waypointid = 0),
      (x: any) => x.route.waypoints.forEach((w: any) => (w.show = false)),
    ]) {
      const x = fixture();
      change(x);
      expect(() => importRn2(JSON.stringify(x))).toThrow();
    }
  });
  it.skipIf(!process.env.RN2_TEST_FILE)(
    'round-trips the supplied Rally Navigator file',
    () => {
      const text = readFileSync(process.env.RN2_TEST_FILE!, 'utf8');
      const original = JSON.parse(text),
        project = importRn2(text);
      expect(project.entries).toHaveLength(25);
      expect(project.track?.features[0].geometry.coordinates).toHaveLength(314);
      expect(exportRn2(project)).toEqual(original);
    }
  );
});
