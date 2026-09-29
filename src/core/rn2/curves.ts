import type { Point } from './types';

// Natural cubic interpolation, parameterised by sqrt(chord length). This is
// RN2's curve convention; handles are interpolation points, not Bézier controls.
export function sampleRn2Curve(input: Point[], steps = 60): Point[] {
  const p = input.filter(
    (v, i) =>
      !i || Math.hypot(v.x - input[i - 1].x, v.y - input[i - 1].y) > 1e-9
  );
  if (p.length < 2) return p;
  const n = p.length,
    t = [0];
  for (let i = 1; i < n; i++)
    t.push(
      t[i - 1] + Math.sqrt(Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y))
    );
  const derivatives = (axis: 'x' | 'y') => {
    const diagonal = new Array(n).fill(1),
      rhs = new Array(n).fill(0),
      upper = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const a = t[i] - t[i - 1],
        b = t[i + 1] - t[i];
      const ratio = a / diagonal[i - 1];
      diagonal[i] = 2 * (a + b) - ratio * upper[i - 1];
      upper[i] = b;
      rhs[i] =
        6 *
          ((p[i + 1][axis] - p[i][axis]) / b -
            (p[i][axis] - p[i - 1][axis]) / a) -
        ratio * rhs[i - 1];
    }
    const result = new Array(n).fill(0);
    for (let i = n - 2; i > 0; i--)
      result[i] = (rhs[i] - upper[i] * result[i + 1]) / diagonal[i];
    return result;
  };
  const mx = derivatives('x'),
    my = derivatives('y');
  return Array.from({ length: steps + 1 }, (_, j) => {
    const u = (t[n - 1] * j) / steps;
    let i = 0;
    while (i < n - 2 && t[i + 1] < u) i++;
    const h = t[i + 1] - t[i],
      a = (t[i + 1] - u) / h,
      b = 1 - a;
    const at = (axis: 'x' | 'y', m: number[]) =>
      a * p[i][axis] +
      b * p[i + 1][axis] +
      (((a * a * a - a) * m[i] + (b * b * b - b) * m[i + 1]) * h * h) / 6;
    return { x: at('x', mx), y: at('y', my) };
  });
}

// Constrain spline rounding to a small neighbourhood of each polyline corner.
// Keep original vertices; RN2 still stores a Track with usable start/arrow ends.
export function polylineHandles(
  start: Point,
  handles: Point[],
  end: Point
): Point[] {
  const p = [start, ...handles, end].filter(
    (v, i, a) => !i || Math.hypot(v.x - a[i - 1].x, v.y - a[i - 1].y) > 1e-7
  );
  const out: Point[] = [];
  for (let i = 1; i < p.length - 1; i++) {
    const v = p[i];
    for (const neighbour of [p[i - 1], p[i + 1]]) {
      const len = Math.hypot(neighbour.x - v.x, neighbour.y - v.y),
        f = Math.min(0.001, 0.01 / len);
      if (neighbour === p[i + 1]) out.push(v);
      out.push({
        x: v.x + (neighbour.x - v.x) * f,
        y: v.y + (neighbour.y - v.y) * f,
      });
    }
  }
  return out;
}

export function roadLayers(
  type: number,
  color = 'black'
): { color: string; width: number; dash?: string }[] {
  if ([8, 10, 12, 18].includes(type))
    return [
      { color, width: type === 12 ? 8.5 : type === 18 ? 7 : 8 },
      { color: 'white', width: type === 12 ? 5 : type === 18 ? 2.5 : 4 },
      ...(type === 12 ? [{ color: 'grey', width: 2 }] : []),
    ];
  return [
    {
      color,
      width: type === 14 ? 8 : [6, 17].includes(type) ? 6 : 4,
      dash: ({ 2: '5 10', 15: '2 9 7 9', 16: '2 9' } as Record<number, string>)[
        type
      ],
    },
  ];
}

export function linearizeRn2Elements(
  elements: Record<string, any>[]
): Record<string, any>[] {
  return elements.flatMap(original => {
    const e = structuredClone(original);
    if (e.type === 'Track') {
      for (const r of [e.roadIn, e.roadOut])
        if (r?.end)
          r.handles = polylineHandles({ x: 0, y: 0 }, r.handles || [], r.end);
    }
    if (e.type === 'Road') {
      const coords = [
        e.start || { x: 0, y: 0 },
        ...(e.handles || []),
        e.end,
      ].filter(Boolean);
      return roadLayers(e.typeId || 4).map(l => ({
        type: 'Line',
        eId: globalThis.crypto.randomUUID(),
        z: e.z || 4,
        path: coords.map((p, i) => [i ? 'L' : 'M', p.x + 100, p.y + 85]),
        stroke: l.color,
        strokeWidth: l.width,
        strokeDashArray: l.dash?.split(' ').map(Number),
        fill: 'transparent',
        pathOffset: { x: 0, y: 0 },
        strokeLineCap: 'round',
      }));
    }
    return [e];
  });
}
