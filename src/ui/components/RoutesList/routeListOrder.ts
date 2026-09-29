import type { UserRoute } from '../../stores/routesStore';
export function routeLength(route: UserRoute): number | null {
  const value =
    (route as UserRoute & { distance_m?: number }).distance_m ??
    route.cached_brouterTrack_data?.features[0]?.properties?.['track-length'];
  const meters = value == null ? NaN : Number(value);
  return Number.isFinite(meters) && meters >= 0 ? meters : null;
}
export function filterAndSortRoutes(
  routes: UserRoute[],
  query: string,
  order: string
): UserRoute[] {
  const direction = order.endsWith('-desc') ? -1 : 1;
  return routes
    .filter(r =>
      r.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
    .sort((a, b) => {
      let result = 0;
      if (order.startsWith('name'))
        result = a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      else if (order.startsWith('length')) {
        const x = routeLength(a),
          y = routeLength(b);
        if (x === null || y === null)
          return x === y ? a.id.localeCompare(b.id) : x === null ? 1 : -1;
        result = x - y;
      } else
        result =
          (Date.parse(a.updated_at || a.created_at) || 0) -
          (Date.parse(b.updated_at || b.created_at) || 0);
      return direction * result || a.id.localeCompare(b.id);
    });
}
