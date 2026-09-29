// RN2 v4 document support. Unknown fields are deliberately retained for round trips.
export type Rn2Element = Record<string, any>;
export type Rn2Waypoint = Record<string, any> & {
  waypointid: number;
  lat: number;
  lon: number;
  show: boolean;
  tulip?: { elements: Rn2Element[] };
  notes?: { elements: Rn2Element[] };
};
export type Rn2Document = Record<string, any> & {
  route: Record<string, any> & {
    version: 4;
    name: string;
    waypoints: Rn2Waypoint[];
  };
};

export function readRn2(text: string): Rn2Document {
  if (text.length > 25_000_000)
    throw new Error('RN2-Datei ist größer als 25 MB.');
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('Die RN2-Datei enthält kein gültiges JSON.');
  }
  const r = doc?.route;
  if (!r || r.version !== 4)
    throw new Error('Unterstützt werden RN2-Dateien der Version 4.');
  if (
    typeof r.name !== 'string' ||
    r.name.length > 300 ||
    !Array.isArray(r.waypoints) ||
    r.waypoints.length < 2 ||
    r.waypoints.length > 100000
  )
    throw new Error('RN2: Name oder Trackpunkte ungültig.');
  const ids = new Set<number>();
  for (const w of r.waypoints) {
    if (
      !w ||
      !Number.isInteger(w.waypointid) ||
      ids.has(w.waypointid) ||
      typeof w.show !== 'boolean' ||
      !Number.isFinite(w.lat) ||
      !Number.isFinite(w.lon) ||
      Math.abs(w.lat) > 90 ||
      Math.abs(w.lon) > 180
    )
      throw new Error('RN2: Ungültige Koordinaten oder doppelte Wegpunkt-ID.');
    ids.add(w.waypointid);
    for (const cell of [w.tulip, w.notes]) {
      if (
        cell != null &&
        (!Array.isArray(cell.elements) ||
          cell.elements.length > 1000 ||
          cell.elements.some(
            (e: any) => !e || typeof e !== 'object' || Array.isArray(e)
          ))
      )
        throw new Error('RN2: Ungültige Zeichnung.');
    }
  }
  if (!r.waypoints.some((w: Rn2Waypoint) => w.show))
    throw new Error('RN2 enthält keine sichtbaren Roadbook-Einträge.');
  return doc;
}

const escape = (text: unknown) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!
  );
const num = (n: unknown, fallback = 0) =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.max(-10000, Math.min(10000, n))
    : fallback;
const point = (p: any, fallback: { x: number; y: number }) => ({
  x: num(p?.x, fallback.x),
  y: num(p?.y, fallback.y),
});
export function rn2Notes(w: Rn2Waypoint): string {
  return [
    ...(w.notes?.elements || []),
    ...(w.waypointIcon ? [{ ...w.waypointIcon, type: 'Icon' }] : []),
  ]
    .map(e =>
      e.type === 'Text'
        ? String(e.text || '')
        : e.type === 'Icon'
          ? `[${e.name || 'Symbol'}]`
          : ''
    )
    .filter(Boolean)
    .join('\n');
}

// RN2 geometry uses an absolute track anchor and relative endpoints/handles.
export function rn2Preview(
  w: Rn2Waypoint,
  settings: Record<string, any> = {},
  icon?: (e: Rn2Element) => string | undefined,
  headingChange = 0
): string {
  const parts: string[] = [];
  const anchor = point(
    w.tulip?.elements?.find(e => e.type === 'Track')?.roadOut?.start,
    {
      x: settings.current_style === 'cross_country_dakar' ? 119.5 : 99.5,
      y: settings.tulipLoweredLayout ? 94 : 84,
    }
  );
  const color =
    settings.trackColor === 1 || settings.trackColor === 2 ? 'black' : 'blue';
  const line = (
    pts: { x: number; y: number }[],
    type: number,
    tint = 'black'
  ) =>
    roadLayers(type, tint)
      .map(
        l =>
          `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${l.color}" stroke-width="${l.width}" stroke-linecap="round" stroke-linejoin="round"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/>`
      )
      .join('');
  const curve = (r: any, end: { x: number; y: number }, isTrack = false) => {
    const local = [
      isTrack ? { x: 0, y: 0 } : point(r?.start, { x: 0, y: 0 }),
      ...(Array.isArray(r?.handles) ? r.handles : [])
        .filter(Boolean)
        .map((p: any) => point(p, { x: 0, y: 0 })),
      point(r?.end, end),
    ];
    return sampleRn2Curve(local).map(p => ({
      x: p.x + anchor.x,
      y: p.y + anchor.y,
    }));
  };
  for (const e of [...(w.tulip?.elements || [])].sort(
    (a, b) => num(a.z) - num(b.z)
  )) {
    if (e.type === 'Track' || e.type === 'Road') {
      if (e.type === 'Road')
        parts.push(line(curve(e, { x: 40, y: 0 }), num(e.typeId, 4)));
      else {
        const inType =
          e.roadIn?.typeId ||
          e.roadIn?.t_inheritedTrackType ||
          settings.defaultTrackType ||
          17;
        const outType =
          e.roadOut?.typeId || e.roadOut?.t_inheritedTrackType || inType;
        const length = settings.tulipLoweredLayout ? 65 : 55,
          angle = (headingChange * Math.PI) / 180;
        const incoming = curve(
          e.roadIn,
          { x: 0, y: settings.tulipLoweredLayout ? 32 : 40 },
          true
        );
        const outgoing = curve(
          e.roadOut,
          {
            x: Math.sin(angle) * length,
            y: Math.min(35, -Math.cos(angle) * length),
          },
          true
        );
        if (
          settings.trackColor === 2 ||
          (settings.trackColor === 1 && settings.showHighlight)
        )
          parts.push(
            `<polyline points="${[...incoming]
              .reverse()
              .concat(outgoing)
              .map(p => `${p.x},${p.y}`)
              .join(
                ' '
              )}" stroke="#4cc7ff" stroke-opacity=".75" stroke-width="16" fill="none"/>`
          );
        parts.push(
          line(incoming, inType, color),
          line(outgoing, outType, color)
        );
        const end = outgoing.at(-1)!,
          prev = outgoing.at(-2) || end;
        const rotation =
          (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
        parts.push(
          `<path d="M 0 -8 L 16 0 L 0 8 Z" fill="${color}" transform="translate(${end.x} ${end.y}) rotate(${rotation})"/>`
        );
        if (settings.trackColor === 1 || settings.trackColor === 2) {
          const dot = incoming.at(-1)!;
          parts.push(
            `<circle cx="${dot.x}" cy="${dot.y}" r="6" fill="${color}"/>`
          );
        }
        if (settings.showDistanceTickMark || w.showDistanceTickMark) {
          const a = (num(w.distanceTickMarkAngle, 135) * Math.PI) / 180,
            x = anchor.x - 1 + 18 * Math.sin(a),
            y = anchor.y - 18 * Math.cos(a);
          parts.push(
            `<path d="M ${anchor.x - 1} ${anchor.y} L ${x} ${y}" fill="none" stroke="black" stroke-width="2"/>`
          );
          if (color === 'blue')
            parts.push(`<circle cx="${x}" cy="${y}" r="3"/>`);
        }
      }
    } else if (e.type === 'Icon' && icon?.(e)) {
      parts.push(icon(e)!);
    } else if (e.type === 'Text' || e.type === 'Icon') {
      const label =
        e.type === 'Icon' ? `[${e.name || 'Symbol'}]` : String(e.text || '');
      const size =
        e.type === 'Icon' ? 9 : Math.max(4, Math.min(36, num(e.fontSize, 18)));
      const maxWidth = Math.max(size, num(e.width, 180));
      const measure = (s: string) =>
        Array.from(s).reduce(
          (n, c) =>
            n +
            (/[ilI.,!' :;]/.test(c) ? 0.28 : /[MW@]/.test(c) ? 0.85 : 0.56) *
              size,
          0
        );
      const lines = label.split('\n').flatMap(paragraph => {
        const wrapped: string[] = [];
        let current = '';
        for (const word of paragraph.split(/\s+/)) {
          if (current && measure(current + ' ' + word) > maxWidth) {
            wrapped.push(current);
            current = word;
          } else current += (current ? ' ' : '') + word;
        }
        wrapped.push(current);
        return wrapped;
      });
      parts.push(
        `<text x="${num(e.x, 99.5)}" y="${num(e.y, 67.5) - (size * (lines.length - 1)) / 2}" text-anchor="middle" font-family="Helvetica" font-size="${size}" fill="${safeColor(e.fill)}">${lines.map((l, i) => `<tspan x="${num(e.x, 99.5)}" dy="${i ? size * num(e.lineHeight, 1) : 0}">${escape(l)}</tspan>`).join('')}</text>`
      );
    } else if (e.type === 'Line' && Array.isArray(e.path)) {
      const path = e.path
        .filter(
          (s: any) =>
            Array.isArray(s) && ['M', 'L', 'Q', 'C', 'Z'].includes(s[0])
        )
        .map(
          (s: any) =>
            s[0] +
            ' ' +
            s
              .slice(1)
              .map((v: any) => num(v))
              .join(' ')
        )
        .join(' ');
      const dash = Array.isArray(e.strokeDashArray)
        ? ` stroke-dasharray="${e.strokeDashArray.map((v: any) => num(v)).join(' ')}"`
        : '';
      parts.push(
        `<path d="${path}" fill="${safeColor(e.fill, 'none')}" stroke="${safeColor(e.stroke, '#555555')}" stroke-width="${num(e.strokeWidth, 2)}" stroke-linecap="round"${dash}/>`
      );
    } else if (e.type === 'ArrowDistance' && Array.isArray(e.points))
      parts.push(
        line(
          sampleRn2Curve(e.points.map((p: any) => point(p, { x: 0, y: 0 }))),
          4
        )
      );
  }
  const width = settings.current_style === 'cross_country_dakar' ? 239 : 199;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 135" width="${width}" height="135">${parts.join('')}</svg>`;
}
function safeColor(value: unknown, fallback = 'black'): string {
  return typeof value === 'string' &&
    /^(#[a-f\d]{3,8}|[a-z]+|rgba?\([\d., %]+\))$/i.test(value)
    ? value === 'transparent'
      ? 'none'
      : value
    : fallback;
}
import { sampleRn2Curve, roadLayers } from './curves';
