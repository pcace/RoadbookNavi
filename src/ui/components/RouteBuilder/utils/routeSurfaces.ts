import { distance, point } from '@turf/turf';
import type { FeatureCollection, LineString, Feature } from 'geojson';

/** Same tag fallbacks as the web routing endpoint; inferred values retain their source. */
export function surfaceTags(tags: string): Record<string, string> {
  const props: Record<string, string> = Object.fromEntries(
    tags
      .split(/\s+/)
      .filter(t => t.includes('='))
      .map(t => [t.slice(0, t.indexOf('=')), t.slice(t.indexOf('=') + 1)])
  );
  if (!props.surface && props.tracktype) {
    props.surface =
      (
        {
          grade1: 'paved',
          grade2: 'gravel',
          grade3: 'unpaved',
          grade4: 'dirt',
          grade5: 'sand',
        } as Record<string, string>
      )[props.tracktype] || 'unpaved';
    props.surface_source = 'tracktype';
  }
  if (!props.surface && props.highway) {
    if (props.highway === 'track') props.surface = 'unpaved';
    else if (
      [
        'motorway',
        'trunk',
        'primary',
        'secondary',
        'tertiary',
        'motorway_link',
        'trunk_link',
        'primary_link',
        'secondary_link',
        'tertiary_link',
        'residential',
        'living_street',
        'service',
        'unclassified',
        'proposed',
      ].includes(props.highway)
    )
      props.surface = 'paved';
    if (props.surface) props.surface_source = 'highway';
  }
  props.surface ||= 'unknown';
  return props;
}
/** O(vertices + messages); only a map projection, never replaces the saved raw BRouter track. */
export function routeSurfacePreview(
  data: FeatureCollection<LineString>
): FeatureCollection<LineString> {
  const feature = data.features[0],
    messages = feature?.properties?.messages;
  if (Array.isArray(feature?.properties?.surfaceSegments))
    return {
      type: 'FeatureCollection',
      features: feature.properties.surfaceSegments,
    };
  if (
    data.features.length !== 1 ||
    !Array.isArray(messages) ||
    messages.length < 2
  )
    return data;
  const header = messages[0] as string[],
    di = header.findIndex(x => /distance/i.test(x)),
    ti = header.findIndex(x => /waytags/i.test(x));
  if (di < 0 || ti < 0) return data;
  const coords = feature.geometry.coordinates;
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        distance(point(coords[i - 1]), point(coords[i]), { units: 'meters' })
    );
  const total = cumulative.at(-1) || 0;
  if (!total) return data;
  const output: Feature<LineString>[] = [];
  let cursor = 1,
    consumed = 0,
    start = coords[0];
  for (let row = 1; row < messages.length && consumed < total; row++) {
    const size = Number(messages[row][di]);
    if (!Number.isFinite(size) || size <= 0) continue;
    const end =
      row === messages.length - 1 ? total : Math.min(total, consumed + size);
    const points = [start];
    while (cursor < coords.length && cumulative[cursor] < end)
      points.push(coords[cursor++]);
    if (cursor >= coords.length) start = coords.at(-1)!;
    else {
      const a = coords[cursor - 1],
        b = coords[cursor],
        fraction =
          (end - cumulative[cursor - 1]) /
          (cumulative[cursor] - cumulative[cursor - 1] || 1);
      start = a.map((v, k) => v + (b[k] - v) * fraction);
    }
    points.push(start);
    output.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points },
      properties: {
        ...surfaceTags(String(messages[row][ti] || '')),
        length_m: end - consumed,
      },
    });
    consumed = end;
  }
  return output.length ? { type: 'FeatureCollection', features: output } : data;
}
