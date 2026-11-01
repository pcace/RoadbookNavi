import { normalizeLanguage } from './ui/i18n/languages';
import { validateProject, validPoint } from './model';
import type { BRouterGeoJSON } from './core/types';
import i18n from './ui/i18n';

const profiles = Object.fromEntries(
  Object.entries(
    import.meta.glob('../native/profiles/*.brf', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  ).map(([path, content]) => [
    path.split('/').pop()!.replace('.brf', ''),
    content as string,
  ])
);
const BROUTER = 'https://brouter.de/brouter';
const TILE_CACHE = 'roadbooknavi-web-tiles-v1';
const GEOCODE_CACHE = 'roadbooknavi-web-geocoding-v1';
const uploads = new Map<string, Promise<string>>();
let database: Promise<IDBDatabase> | undefined;

function projectStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('roadbooknavi-web-projects', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  });
  return database.then(
    db =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction('projects', mode);
        const request = action(transaction.objectStore('projects'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error || request.error);
        transaction.onerror = () => reject(transaction.error || request.error);
      })
  );
}

async function checkedFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(120000),
    ...init,
  });
  if (!response.ok)
    throw new Error(
      `${i18n.t('web.requestFailed')}: ${response.status} ${(await response.text()).slice(0, 250)}`
    );
  return response;
}

async function profileId(profile: string, renew = false): Promise<string> {
  const source = Object.hasOwn(profiles, profile)
    ? profiles[profile]
    : undefined;
  if (!source) {
    if (profile === 'trekking') return profile;
    throw new Error(i18n.t('web.unknownProfile', { profile }));
  }
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
    )
  )
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  const key = `roadbooknavi-brouter-${hash}`;
  if (renew) uploads.delete(key);
  let pending = uploads.get(key);
  if (!pending) {
    pending = (async () => {
      if (!renew) {
        try {
          const saved = localStorage.getItem(key);
          if (saved && /^custom_\d+$/.test(saved)) return saved;
        } catch {
          /* Storage can be unavailable in private browser sessions. */
        }
      }
      const response = await checkedFetch(`${BROUTER}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: source,
      });
      const data = await response.json();
      if (data.error || !/^custom_\d+$/.test(data.profileid))
        throw new Error(`${i18n.t('web.profileFailed')}: ${data.error || ''}`);
      try {
        localStorage.setItem(key, data.profileid);
      } catch {
        /* Keep the in-memory ID. */
      }
      return data.profileid as string;
    })();
    uploads.set(key, pending);
    pending.catch(() => uploads.delete(key));
  }
  return pending;
}

async function route(args: Record<string, unknown>): Promise<BRouterGeoJSON> {
  const profile = String(args.profile);
  const lonlats = String(args.lonlats);
  const points = lonlats.split('|').map(pair => {
    const [lon, lat] = pair.split(',').map(Number);
    return { lon, lat };
  });
  if (points.length < 2 || !points.every(validPoint))
    throw new Error(i18n.t('web.invalidRoute'));
  for (const renew of [false, true]) {
    const params = new URLSearchParams({
      lonlats,
      profile: await profileId(profile, renew),
      alternativeidx: '0',
      format: 'geojson',
      timode: '3',
    });
    if (args.polygons) params.set('polygons', String(args.polygons));
    const response = await fetch(`${BROUTER}?${params}`, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 250);
      if (
        !renew &&
        profiles[profile] &&
        /profile|\.brf|does not exist/i.test(detail)
      )
        continue;
      throw new Error(
        `${i18n.t('web.requestFailed')}: ${response.status} ${detail}`
      );
    }
    const data = (await response.json()) as BRouterGeoJSON;
    const feature = data.features?.[0];
    if (
      data.type !== 'FeatureCollection' ||
      feature?.geometry?.type !== 'LineString' ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length < 2 ||
      !Array.isArray(feature.properties?.messages)
    )
      throw new Error(i18n.t('web.invalidRoute'));
    return data;
  }
  throw new Error(i18n.t('web.profileFailed'));
}

let tileSource: Promise<string> | undefined;
async function mapTile(args: Record<string, unknown>) {
  tileSource ??= checkedFetch('https://tiles.openfreemap.org/planet')
    .then(r => r.json())
    .then(data => {
      const template = data.tiles?.[0];
      if (
        typeof template !== 'string' ||
        !template.startsWith('https://tiles.openfreemap.org/planet/')
      )
        throw new Error(i18n.t('web.requestFailed'));
      return template;
    })
    .catch(error => {
      tileSource = undefined;
      throw error;
    });
  const template = await tileSource;
  const url = template
    .replace('{z}', String(args.z))
    .replace('{x}', String(args.x))
    .replace('{y}', String(args.y));
  const response = await cachedFetch(TILE_CACHE, url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { data: btoa(binary), version: template.split('/')[4], cached: true };
}

async function cachedFetch(name: string, url: string) {
  let cache: Cache | undefined;
  try {
    cache = await caches.open(name);
    const cached = await cache.match(url);
    if (cached) return cached;
  } catch {
    /* Downloads still work when browser caching is unavailable. */
  }
  const response = await checkedFetch(url);
  try {
    await cache?.put(url, response.clone());
  } catch {
    /* Storage quota does not prevent use. */
  }
  return response;
}

let geocodeQueue: Promise<unknown> = Promise.resolve();
let nextGeocode = 0;
function geocode(args: Record<string, unknown>) {
  const run = geocodeQueue
    .catch(() => {})
    .then(async () => {
      const url = new URL(
        `${String(args.base).replace(/\/$/, '')}/${args.operation}`
      );
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('geocoding.insecureServiceUrl');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set(
        'accept-language',
        normalizeLanguage(
          typeof args.language === 'string' ? args.language : undefined
        )
      );
      if (args.key) url.searchParams.set('api_key', String(args.key));
      if (args.operation === 'search') {
        url.searchParams.set('q', String(args.query));
        url.searchParams.set('limit', '8');
      } else {
        url.searchParams.set('lat', Number(args.lat).toFixed(5));
        url.searchParams.set('lon', Number(args.lon).toFixed(5));
      }
      try {
        const cached = await (await caches.open(GEOCODE_CACHE)).match(url);
        if (cached) return cached.json();
      } catch {
        /* Continue without cache. */
      }
      await new Promise(resolve =>
        setTimeout(resolve, Math.max(0, nextGeocode - Date.now()))
      );
      nextGeocode = Date.now() + 1100;
      return (await cachedFetch(GEOCODE_CACHE, url.href)).json();
    });
  geocodeQueue = run;
  return run;
}

export async function invokeWeb<T>(
  command: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  let result: unknown;
  switch (command) {
    case 'list_projects':
      result = (await projectStore('readonly', store => store.getAll())).map(
        validateProject
      );
      break;
    case 'save_project':
      result = await projectStore('readwrite', store =>
        store.put(validateProject(args.project))
      );
      break;
    case 'delete_project':
      result = await projectStore('readwrite', store =>
        store.delete(String(args.id))
      );
      break;
    case 'library':
      result = { profiles: ['trekking', ...Object.keys(profiles).sort()] };
      break;
    case 'calculate_route':
      result = await route(args);
      break;
    case 'get_map_tile':
      result = await mapTile(args);
      break;
    case 'geocode':
      result = await geocode(args);
      break;
    case 'geographic_cache_usage': {
      let mapTiles = 0;
      try {
        const cache = await caches.open(TILE_CACHE);
        for (const key of await cache.keys())
          mapTiles += (await (await cache.match(key))!.arrayBuffer())
            .byteLength;
      } catch {
        /* An empty or unavailable cache uses no reported bytes. */
      }
      result = { mapTiles, routing: 0 };
      break;
    }
    case 'clear_geographic_cache':
      if (args.kind === 'mapTiles') await caches.delete(TILE_CACHE);
      break;
    case 'storage_usage': {
      const usage = await navigator.storage.estimate();
      result = {
        available: Math.max(0, (usage.quota || 0) - (usage.usage || 0)),
        total: usage.quota || 0,
      };
      break;
    }
    default:
      throw new Error(`Unsupported browser command: ${command}`);
  }
  return result as T;
}
