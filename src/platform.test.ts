import { expect, it, vi } from 'vitest';
const native = vi.hoisted(() => vi.fn().mockResolvedValue('local route'));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: native,
}));
import { invoke } from './platform';

it('keeps native routing on the local Tauri command without network requests', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const args = {
    profile: 'enduro-easy',
    lonlats: '13,52|13.1,52.1',
    polygons: '',
  };
  expect(await invoke('calculate_route', args)).toBe('local route');
  expect(native).toHaveBeenCalledWith('calculate_route', args);
  expect(fetch).not.toHaveBeenCalled();
});
