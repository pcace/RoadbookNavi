import { it, expect } from 'vitest';
import { filterAndSortRoutes } from './routeListOrder';
import type { UserRoute } from '../../stores/routesStore';
it('filters names, orders dates and distances, and leaves missing distances last', () => {
  const routes = [
    { id: '1', name: 'Tour 10', updated_at: '2026-01-01', distance_m: 400 },
    { id: '2', name: 'tour 2', updated_at: '2026-03-01', distance_m: 900 },
    { id: '3', name: 'Other', updated_at: '2026-02-01' },
  ] as unknown as UserRoute[];
  expect(
    filterAndSortRoutes(routes, ' TOUR ', 'name-asc').map(r => r.id)
  ).toEqual(['2', '1']);
  expect(filterAndSortRoutes(routes, '', 'date-desc').map(r => r.id)).toEqual([
    '2',
    '3',
    '1',
  ]);
  expect(filterAndSortRoutes(routes, '', 'length-asc').map(r => r.id)).toEqual([
    '1',
    '2',
    '3',
  ]);
  expect(filterAndSortRoutes(routes, '', 'length-desc').map(r => r.id)).toEqual(
    ['2', '1', '3']
  );
  expect(routes[0].id).toBe('1');
});
