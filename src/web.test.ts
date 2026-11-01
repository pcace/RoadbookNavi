import { beforeEach, expect, it, vi } from 'vitest';
import track from './fixtures/route2.json';
import { parseRoute } from './core/routeParser';
import { detectTurns } from './core/turnDetection';
import type { BRouterGeoJSON } from './core/types';

vi.mock('./ui/i18n', () => ({ default: { t: (key: string) => key } }));
const fetchMock = vi.fn();
const saved = new Map<string, string>();
const request = {
  profile: 'enduro-easy',
  lonlats: '13.388,52.517|13.397,52.52',
  polygons: '',
};

it.each([
  ['es-MX', 'es'],
  ['fr-CA', 'fr'],
  ['de-DE', 'de'],
  ['it', 'en'],
])('requests place names in %s using %s', async (language, expected) => {
  const { invokeWeb } = await import('./web');
  fetchMock.mockResolvedValueOnce(Response.json([]));
  await invokeWeb('geocode', {
    base: 'https://example.org',
    operation: 'search',
    query: 'Paris',
    language,
  });
  expect(
    new URL(fetchMock.mock.calls[0][0]).searchParams.get('accept-language')
  ).toBe(expected);
});

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  saved.clear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key),
    setItem: (key: string, value: string) => saved.set(key, value),
  });
});

it('uploads our bundled profile once and returns data accepted by the unchanged roadbook pipeline', async () => {
  const { invokeWeb } = await import('./web');
  fetchMock
    .mockResolvedValueOnce(Response.json({ profileid: 'custom_123' }))
    .mockResolvedValueOnce(Response.json(track))
    .mockResolvedValueOnce(Response.json(track));
  const route = await invokeWeb<BRouterGeoJSON>('calculate_route', request);
  await invokeWeb('calculate_route', request);
  const [url, upload] = fetchMock.mock.calls[0];
  expect(url).toBe('https://brouter.de/brouter/profile');
  expect(upload.method).toBe('POST');
  expect(upload.body).toContain('---context:way');
  const params = new URL(fetchMock.mock.calls[1][0]).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    profile: 'custom_123',
    timode: '3',
    format: 'geojson',
    lonlats: request.lonlats,
  });
  expect(
    fetchMock.mock.calls.filter(([url]) => url.endsWith('/profile'))
  ).toHaveLength(1);
  expect(detectTurns(parseRoute(route)).length).toBeGreaterThan(2);
});

it('reuses an uploaded profile after reopening the app', async () => {
  let { invokeWeb } = await import('./web');
  fetchMock
    .mockResolvedValueOnce(Response.json({ profileid: 'custom_123' }))
    .mockResolvedValueOnce(Response.json(track));
  await invokeWeb('calculate_route', request);
  vi.resetModules();
  ({ invokeWeb } = await import('./web'));
  fetchMock.mockResolvedValueOnce(Response.json(track));
  await invokeWeb('calculate_route', request);
  expect(
    fetchMock.mock.calls.filter(([url]) => url.endsWith('/profile'))
  ).toHaveLength(1);
});

it('reuploads an expired server profile and retries the route once', async () => {
  const { invokeWeb } = await import('./web');
  fetchMock
    .mockResolvedValueOnce(Response.json({ profileid: 'custom_123' }))
    .mockResolvedValueOnce(
      new Response('profile does not exist', { status: 400 })
    )
    .mockResolvedValueOnce(Response.json({ profileid: 'custom_456' }))
    .mockResolvedValueOnce(Response.json(track));
  await invokeWeb('calculate_route', request);
  expect(new URL(fetchMock.mock.calls[3][0]).searchParams.get('profile')).toBe(
    'custom_456'
  );
});

it('rejects profile validation errors even when BRouter responds with HTTP 200', async () => {
  const { invokeWeb } = await import('./web');
  fetchMock.mockResolvedValueOnce(
    Response.json({ profileid: 'custom_123', error: 'Profile error' })
  );
  await expect(invokeWeb('calculate_route', request)).rejects.toThrow(
    'web.profileFailed'
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does not replace an unknown imported profile with a different routing profile', async () => {
  const { invokeWeb } = await import('./web');
  await expect(
    invokeWeb('calculate_route', { ...request, profile: 'my-private-profile' })
  ).rejects.toThrow('web.unknownProfile');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('reports routing failure without accepting malformed GeoJSON', async () => {
  const { invokeWeb } = await import('./web');
  fetchMock.mockResolvedValueOnce(
    Response.json({ type: 'FeatureCollection', features: [] })
  );
  await expect(
    invokeWeb('calculate_route', { ...request, profile: 'trekking' })
  ).rejects.toThrow('web.invalidRoute');
});

it('lists all five shared Enduro profiles without contacting a server', async () => {
  const { invokeWeb } = await import('./web');
  expect((await invokeWeb<{ profiles: string[] }>('library')).profiles).toEqual(
    expect.arrayContaining([
      'enduro',
      'enduro-easy',
      'enduro-medium',
      'enduro-hard',
      'enduro_new',
    ])
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
