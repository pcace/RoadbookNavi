import { describe, expect, it } from 'vitest';
import {
  buildRoutePlanningPath,
  buildRoadbookPath,
  getAppSectionFromPathname,
  parseRoadbookRouteRef,
  slugifyRoadbookRouteName,
} from './roadbookRoute';

describe('roadbookRoute utils', () => {
  it('builds and parses roadbook route references consistently', () => {
    expect(buildRoadbookPath()).toBe('/app/roadbook');
    expect(buildRoadbookPath('123')).toBe('/app/roadbook/123');
    expect(buildRoutePlanningPath()).toBe('/app/route-planning');
    expect(buildRoutePlanningPath('123')).toBe('/app/route-planning/123/edit');

    expect(slugifyRoadbookRouteName('  Ä Ö Ü Test Route  ')).toBe(
      'a-o-u-test-route'
    );

    expect(
      parseRoadbookRouteRef(
        'desert-classic-123e4567-e89b-42d3-a456-426614174000'
      )
    ).toEqual({
      routeId: '123e4567-e89b-42d3-a456-426614174000',
      routeSlug: 'desert-classic',
      routeName: 'desert classic',
    });

    expect(parseRoadbookRouteRef('custom-slug-only')).toEqual({
      routeId: null,
      routeSlug: 'custom-slug-only',
      routeName: 'custom slug only',
    });

    expect(getAppSectionFromPathname('/app/routes/abc')).toBe('routes');
    expect(getAppSectionFromPathname('/')).toBe('roadbook');
  });
});
