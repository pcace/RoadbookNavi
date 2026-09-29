import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettings } from './ui/stores/settingsStore';
type Config = { enabled: boolean; base: string; key: string };
export const useGeocoding = create<
  Config & { update: (patch: Partial<Config>) => void; error: string | null }
>()(
  persist(
    set => ({
      enabled: true,
      base: 'https://nominatim.openstreetmap.org',
      key: '',
      error: null,
      update: patch => set({ ...patch, error: null }),
    }),
    {
      name: 'roadbooknavi-geocoding',
      version: 1,
      migrate: state => ({ ...(state as Partial<Config>), enabled: true }),
      partialize: ({ enabled, base, key }) => ({ enabled, base, key }),
    }
  )
);
export function normalizePlace(raw: any) {
  const lat = Number(raw?.lat),
    lon = Number(raw?.lon);
  if (
    !raw ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    typeof raw.display_name !== 'string'
  )
    return null;
  return {
    id: Number(raw.place_id) || 0,
    lat,
    lon,
    displayName: raw.display_name,
    address: raw.address && typeof raw.address === 'object' ? raw.address : {},
    type: raw.type,
    importance: raw.importance,
  };
}
async function lookup(
  operation: 'search' | 'reverse',
  query = '',
  lat = 0,
  lon = 0
) {
  const { enabled, base, key } = useGeocoding.getState();
  if (!enabled) return null;
  try {
    const value = await invoke<any>('geocode', {
      base: base.trim(),
      key: key.trim(),
      operation,
      query,
      lat,
      lon,
      language: useSettings.getState().interface.language,
    });
    useGeocoding.setState({ error: null });
    return value;
  } catch (e) {
    useGeocoding.setState({ error: String(e) });
    return null;
  }
}
export async function onlineSearch(query: string) {
  const values = await lookup('search', query);
  return Array.isArray(values)
    ? values
        .map(normalizePlace)
        .filter((v): v is NonNullable<typeof v> => v !== null)
    : null;
}
export async function onlineReverse(lat: number, lon: number) {
  const value = await lookup('reverse', '', lat, lon);
  return normalizePlace(value);
}
