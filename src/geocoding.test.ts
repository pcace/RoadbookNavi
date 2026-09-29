import { it, expect, vi, beforeEach } from 'vitest';
const native = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: native }));
vi.mock('./ui/stores/settingsStore', () => ({
  useSettings: { getState: () => ({ interface: { language: 'de' } }) },
}));
import {
  normalizePlace,
  onlineSearch,
  onlineReverse,
  useGeocoding,
} from './geocoding';
beforeEach(() => {
  native.mockReset();
  useGeocoding.setState({
    enabled: false,
    base: 'https://nominatim.openstreetmap.org',
    key: '',
    error: null,
  });
});
it('does not contact the provider when online lookup is disabled', async () => {
  expect(await onlineSearch('Berlin')).toBeNull();
  expect(await onlineReverse(52, 13)).toBeNull();
  expect(native).not.toHaveBeenCalled();
});
it('normalizes Nominatim results and preserves address components for naming', async () => {
  useGeocoding.setState({ enabled: true });
  const place = {
    place_id: 123,
    lat: '52.5',
    lon: '13.4',
    display_name: 'Berlin, Deutschland',
    address: { city: 'Berlin' },
  };
  native
    .mockResolvedValueOnce([
      place,
      { lat: 'bad', lon: 1, display_name: 'invalid' },
    ])
    .mockResolvedValueOnce(place);
  expect((await onlineSearch('Berlin'))?.[0]).toMatchObject({
    id: 123,
    lat: 52.5,
    lon: 13.4,
    address: { city: 'Berlin' },
  });
  expect(await onlineReverse(52.5, 13.4)).toMatchObject({
    displayName: 'Berlin, Deutschland',
  });
  expect(native.mock.calls[0][1]).toMatchObject({
    operation: 'search',
    language: 'de',
    key: '',
  });
  expect(normalizePlace({ lat: 91, lon: 1, display_name: 'bad' })).toBeNull();
});
it('allows local fallback on quota/network errors and exposes the reason in settings', async () => {
  useGeocoding.setState({ enabled: true });
  native.mockRejectedValue('Anfragelimit erreicht');
  expect(await onlineSearch('Berlin')).toBeNull();
  expect(useGeocoding.getState().error).toBe('Anfragelimit erreicht');
});
