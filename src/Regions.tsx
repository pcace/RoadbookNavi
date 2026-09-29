import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  Input,
  Text,
  Stack,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { invoke } from '@tauri-apps/api/core';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useTranslation } from 'react-i18next';
import type { Feature } from 'geojson';
import { extent, fmtBytes } from './geometry';
import { loadLibrary, catalogueSizes, deviceStorage } from './services';
import type { Region, RegionOffer } from './model';
type Status = {
  phase: string;
  current: number;
  total: number | null;
  detail?: string | null;
  active: boolean;
  error?: string;
  region?: RegionOffer;
  queue?: { id: string; name: string }[];
};
const size = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
// The importer reports stable phase labels that are translated for the UI here.
const PHASE_KEYS: Record<string, string> = {
  'OSM herunterladen (1/3)': 'phases.download',
  'OSM-Daten aufbereiten (2/3)': 'phases.prepare',
  'Routingdaten (3/3)': 'phases.routing',
  Fertig: 'phases.done',
  Abgebrochen: 'phases.cancelled',
};
const SUFFIX_KEYS: Record<string, string> = {
  'Indizes erstellen': 'phases.indexing',
  'Datenbank verdichten': 'phases.compacting',
};
export function Regions() {
  const { t } = useTranslation('regions');
  const phaseText = (phase: string) => {
    const [base, suffix] = phase.split(' · ');
    const text = PHASE_KEYS[base]
      ? t(PHASE_KEYS[base], { defaultValue: base })
      : base;
    const suffixText =
      suffix == null
        ? ''
        : SUFFIX_KEYS[suffix]
          ? t(SUFFIX_KEYS[suffix], { defaultValue: suffix })
          : suffix;
    return suffixText ? `${text} · ${suffixText}` : text;
  };
  const [regions, setRegions] = useState<Region[]>([]),
    [catalog, setCatalog] = useState<RegionOffer[]>([]),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [status, setStatus] = useState<Status | null>(null),
    [loadingCatalog, setLoadingCatalog] = useState(false);
  const lastPhase = useRef<string | undefined>(undefined);
  const [sizes, setSizes] = useState<Record<string, number>>({}),
    [storage, setStorage] = useState<{
      available: number;
      total: number;
    } | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('Pausiert') && !msg.includes('Abgebrochen'))
        setError(msg);
    }
  };
  const refresh = async () => {
    setRegions((await loadLibrary()).regions);
    deviceStorage().then(setStorage).catch(console.error);
  };
  useEffect(() => {
    void run(refresh);
    const poll = () =>
      void invoke<Status | null>('download_status')
        .then(value => {
          setStatus(value);
          if (value?.phase === 'Fertig' && lastPhase.current !== 'Fertig')
            void refresh();
          lastPhase.current = value?.phase;
        })
        .catch(console.error);
    poll();
    const timer = setInterval(poll, 1500);
    window.addEventListener('focus', poll);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', poll);
    };
  }, []);
  const install = async (region: RegionOffer) => {
    setStatus({
      phase: 'Download',
      current: 0,
      total: null,
      active: true,
      region,
    });
    await invoke('install_region', { region });
    await refresh();
    window.dispatchEvent(new Event('regions-changed'));
  };
  const visible = catalog
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 60);
  // Resolve download sizes for the visible regions. The native layer caches each URL.
  useEffect(() => {
    const missing = visible.map(r => r.url).filter(u => sizes[u] == null);
    if (missing.length)
      void catalogueSizes(missing)
        .then(m => setSizes(s => ({ ...s, ...m })))
        .catch(console.error);
  }, [catalog, query]);
  const catalogue = async () => {
    setLoadingCatalog(true);
    try {
      const data = await invoke<{ features: Feature[] }>('get_catalogue', {
        refresh: false,
      });
      setCatalog(
        data.features
          .filter(
            f =>
              f.properties?.urls?.pbf &&
              ['Polygon', 'MultiPolygon'].includes(f.geometry.type)
          )
          .map(f => ({
            id: String(f.properties!.id).replace(/[^\w-]/g, '-'),
            name: f.properties!.name,
            url: f.properties!.urls.pbf,
            bbox: extent(f),
            geometry: f.geometry as Region['geometry'],
          }))
      );
    } finally {
      setLoadingCatalog(false);
    }
  };
  const objectsMatch = status?.detail?.match(
    /^(\d[\d.]*) Objekte verarbeitet$/
  );
  const detail = objectsMatch
    ? t('objectsProcessed', { count: objectsMatch[1].replace(/\./g, '') })
    : (status?.detail ??
      (status && status.phase.includes('aufbereiten')
        ? t('objects', { count: status.current.toLocaleString() })
        : status?.total
          ? `${size(status.current)} / ${size(status.total)}`
          : size(status?.current ?? 0)));
  return (
    <Stack
      gap="4"
      bg="bg.panel"
      borderRadius="6px"
      p="1rem"
      boxShadow="0 1px 3px rgba(0,0,0,0.1)"
    >
      {error && (
        <Text role="alert" color="red.500">
          {error}
        </Text>
      )}
      {status &&
        status.phase &&
        status.phase !== 'Fertig' &&
        status.phase !== 'Abgebrochen' &&
        status.phase !== 'Warteschlange' && (
          <Box borderWidth="1px" p="3" borderRadius="md" role="status">
            <Text fontWeight="medium">{status.region?.name}</Text>
            <Text fontSize="sm">
              {phaseText(status.phase)}
              {status.total
                ? ` · ${Math.min(100, Math.round((status.current / status.total) * 100))} %`
                : ''}
            </Text>
            <progress
              style={{ width: '100%' }}
              value={status.total ? status.current : undefined}
              max={status.total || undefined}
            />
            <Text fontSize="sm">{detail}</Text>
            {status.error && (
              <Text color="red.500" fontSize="sm">
                {status.error}
              </Text>
            )}
            <Flex gap="2" mt="2">
              <Button
                size="sm"
                onClick={() =>
                  void run(() =>
                    status.active
                      ? invoke('cancel_download')
                      : install(status.region!)
                  )
                }
              >
                {status.active ? t('pause') : t('resume')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void run(() => invoke('abort_install'))}
              >
                {t('cancel')}
              </Button>
            </Flex>
          </Box>
        )}
      {!!status?.queue?.length && (
        <Box borderWidth="1px" p="3" borderRadius="md">
          <Text fontWeight="medium">
            {t('queueTitle', { defaultValue: 'Warteschlange' })}
          </Text>
          <Stack gap="1" mt="2">
            {status.queue.map((q, i) => (
              <Flex key={q.id} justify="space-between" align="center" gap="3">
                <Text fontSize="sm">
                  {i + 1}. {q.name}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    void run(() => invoke('remove_queued_region', { id: q.id }))
                  }
                >
                  {t('queueRemove', { defaultValue: 'Entfernen' })}
                </Button>
              </Flex>
            ))}
          </Stack>
          <Text fontSize="xs" color="fg.muted" mt="1">
            {t('queueHint', {
              defaultValue:
                'Gebiete werden nacheinander geladen. Abbruch stoppt alles.',
            })}
          </Text>
        </Box>
      )}
      {regions.map(r => (
        <Flex key={r.id} align="center" justify="space-between" gap="3">
          <Box>
            <Text>{r.name}</Text>
            <Text fontSize="xs" color="fg.muted">
              {new Date(r.downloadedAt * 1000).toLocaleDateString()}
              {r.size != null ? ` · ${fmtBytes(r.size)}` : ''}
            </Text>
          </Box>
          <Button
            size="sm"
            variant="outline"
            disabled={status?.active}
            onClick={() =>
              void run(async () => {
                if (
                  await confirm(t('removeConfirm', { name: r.name }), {
                    kind: 'warning',
                  })
                ) {
                  await invoke('remove_region', { id: r.id });
                  await refresh();
                  window.dispatchEvent(new Event('regions-changed'));
                }
              })
            }
          >
            {t('remove')}
          </Button>
        </Flex>
      ))}
      <Stack gap="2" alignSelf="start" style={{ minWidth: '220px' }}>
        <Button disabled={loadingCatalog} onClick={() => void run(catalogue)}>
          {loadingCatalog ? (
            <>
              {t('loadingCatalogue')}{' '}
              <Spinner
                size="xs"
                display="inline-block"
                verticalAlign="middle"
              />
            </>
          ) : (
            t('addArea')
          )}
        </Button>
      </Stack>
      {!!catalog.length && (
        <>
          <Input
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Text fontSize="xs" color="fg.muted">
            {storage
              ? `${t('freeStorage', { free: fmtBytes(storage.available) })} · ${t('appData', { total: fmtBytes(storage.total) })}`
              : ''}
          </Text>
          <Stack maxH="45vh" overflowY="auto">
            {visible.map(r => {
              const loaded = regions.find(x => x.id === r.id);
              const bytes = loaded?.size ?? sizes[r.url];
              const tooBig =
                bytes != null && storage != null && bytes > storage.available;
              return (
                <Flex key={r.id} justify="space-between" align="center" gap="3">
                  <Box minWidth="0">
                    <Text>{r.name}</Text>
                    <Text
                      fontSize="xs"
                      color={tooBig ? 'orange.500' : 'fg.muted'}
                    >
                      {loaded
                        ? t('loadedSize', { size: fmtBytes(bytes) })
                        : bytes != null
                          ? `${t('downloadSize', { size: fmtBytes(bytes) })}${tooBig ? ` — ${t('tooBig')}` : ''}`
                          : t('sizing')}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    disabled={!!status?.active && status.region?.id === r.id}
                    onClick={() => void run(() => install(r))}
                  >
                    {status?.queue?.some(q => q.id === r.id)
                      ? t('queued', { defaultValue: 'wartet' })
                      : loaded
                        ? t('update')
                        : t('load')}
                  </Button>
                </Flex>
              );
            })}
          </Stack>
        </>
      )}
      <Button
        variant="outline"
        alignSelf="start"
        onClick={() =>
          void run(async () => {
            const path = await open({
              multiple: false,
              filters: [{ name: 'BRouter', extensions: ['brf'] }],
            });
            if (typeof path !== 'string') return;
            await invoke('import_profile', {
              name: path
                .split(/[\\/]/)
                .pop()!
                .replace(/\.brf$/, '')
                .replace(/[^\w-]/g, '-'),
              content: await readTextFile(path),
            });
            window.dispatchEvent(new Event('profiles-changed'));
          })
        }
      >
        {t('importProfile')}
      </Button>
      <Text fontSize="xs" color="fg.muted">
        © OpenStreetMap-Mitwirkende · Geofabrik · BRouter
      </Text>
    </Stack>
  );
}
