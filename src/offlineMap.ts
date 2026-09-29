import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { listen } from '@tauri-apps/api/event';
import { osm, loadLibrary } from './services';
// Keeps the map viewport supplied with local OSM data and marks downloaded
// regions in which routes can be planned. The local
// Daten bleiben auch ohne Verbindung sichtbar.
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
export function setupOfflineMap(map: Map) {
  let disposed = false,
    localSeq = 0,
    regionSeq = 0,
    didFitInitialRegions = false;
  const refresh = async () => {
    if (!map.getSource('local-osm')) return;
    const seq = ++localSeq,
      b = map.getBounds();
    const w = Math.max(-180, b.getWest()),
      e = Math.min(180, b.getEast());
    if (w >= e) return;
    try {
      const data = await osm.query(
        [w, Math.max(-85, b.getSouth()), e, Math.min(85, b.getNorth())],
        map.getZoom() < 11 ? 'map-overview' : 'map'
      );
      if (!disposed && seq === localSeq)
        (map.getSource('local-osm') as GeoJSONSource)?.setData(data);
    } catch (error) {
      console.error('Lokale Kartendaten', error);
    }
  };
  // Keep the region overlay above base map data and below the planned route.
  const ensureRegionLayers = () => {
    if (map.getSource('offline-regions')) return true;
    try {
      map.addSource('offline-regions', { type: 'geojson', data: EMPTY });
      const before = ['route-line', 'loading-route-line'].find(id =>
        map.getLayer(id)
      );
      map.addLayer(
        {
          id: 'offline-region-fill',
          type: 'fill',
          source: 'offline-regions',
          paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.055 },
        } as any,
        before
      );
      map.addLayer(
        {
          id: 'offline-region-border',
          type: 'line',
          source: 'offline-regions',
          paint: {
            'line-color': '#16a34a',
            'line-width': 3,
            'line-dasharray': [4, 3],
          },
        } as any,
        before
      );
      return true;
    } catch {
      return false;
    }
  };
  const refreshRegions = async () => {
    const seq = ++regionSeq;
    try {
      const { regions } = await loadLibrary();
      if (disposed || seq !== regionSeq || !ensureRegionLayers()) return;
      const data = {
        type: 'FeatureCollection',
        features: regions.map(r => ({
          type: 'Feature',
          properties: { name: r.name },
          geometry: r.geometry || {
            type: 'Polygon',
            coordinates: [
              [
                [r.bbox[0], r.bbox[1]],
                [r.bbox[2], r.bbox[1]],
                [r.bbox[2], r.bbox[3]],
                [r.bbox[0], r.bbox[3]],
                [r.bbox[0], r.bbox[1]],
              ],
            ],
          },
        })),
      };
      (map.getSource('offline-regions') as GeoJSONSource)?.setData(
        data as FeatureCollection
      );
      // A new planner normally opens at the former Germany default. Move that
      // initial overview to the available planning area once, while preserving a
      // route-specific or GPS-specific initial camera.
      if (!didFitInitialRegions && regions.length && map.getZoom() <= 6.1) {
        didFitInitialRegions = true;
        const bounds = regions.reduce<[number, number, number, number]>(
          (all, r) => [
            Math.min(all[0], r.bbox[0]),
            Math.min(all[1], r.bbox[1]),
            Math.max(all[2], r.bbox[2]),
            Math.max(all[3], r.bbox[3]),
          ],
          [180, 90, -180, -90]
        );
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 35, duration: 0, maxZoom: 9 }
        );
      }
    } catch (error) {
      console.error('Gebietsmarken', error);
    }
  };
  let unlisten: (() => void) | undefined;
  const start = () => {
    map.setPitch(
      (map.getStyle().metadata as Record<string, unknown>)?.['roadbooknavi:3d']
        ? 60
        : 0
    );
    void refresh();
    void refreshRegions();
  };
  if (map.isStyleLoaded()) start();
  map.on('style.load', start);
  map.on('moveend', refresh);
  const onFocus = () => {
    void refresh();
    void refreshRegions();
  };
  const onRegionsChanged = () => void refreshRegions();
  window.addEventListener('focus', onFocus);
  window.addEventListener('regions-changed', onRegionsChanged);
  void listen('region-progress', event => {
    if ((event.payload as { phase?: string })?.phase === 'Fertig')
      void refreshRegions();
  }).then(fn => {
    if (disposed) fn();
    else unlisten = fn;
  });
  return () => {
    disposed = true;
    map.off('style.load', start);
    map.off('moveend', refresh);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('regions-changed', onRegionsChanged);
    unlisten?.();
  };
}
