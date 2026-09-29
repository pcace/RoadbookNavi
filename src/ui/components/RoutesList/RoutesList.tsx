import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Portal,
  RadioGroup,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useNativeImport } from '../../config/runtime';
import { useAppStore } from '../../stores/appStore';
import { type UserRoute, useRoutesStore } from '../../stores/routesStore';
import { useUIColors } from '../../theme/colors';
import { cacheRoadbookForOffline } from '../../utils/cacheRoadbookForOffline';
import { exportRoadbook } from '../../services/localProjects';
import { offlineCache } from '../../utils/offlineCache';
import {
  buildRoadbookPath,
  buildRoutePlanningPath,
  getRoutePlanningView,
} from '../../utils/roadbookRoute';
import EmptyState from './EmptyState';
import RouteItem from './RouteItem';
import { filterAndSortRoutes } from './routeListOrder';

const EXPORT_FORMATS = [
  ['rn2', 'RallyNavigator (*.rn2)'],
  ['pdf', 'routeBuilder:labels.pdfA5Portrait'],
  ['pdf-roll', 'routeBuilder:labels.pdfScroll'],
  ['gpx', 'GPX Track (*.gpx)'],
  ['geojson', 'GeoJSON (*.geojson)'],
] as const;

const RoutesList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routesStore = useRoutesStore();
  const importRoadbook = useNativeImport();
  const { bg: bgColor } = useUIColors();
  const currentRouteId = useAppStore(state => state.currentRouteId);
  const setCurrentRouteId = useAppStore(state => state.setCurrentRouteId);
  const setCurrentRouteName = useAppStore(state => state.setCurrentRouteName);
  const setRouteBuilderMapView = useAppStore(
    state => state.setRouteBuilderMapView
  );
  const resetRouteBuilder = useAppStore(state => state.resetRouteBuilder);

  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [routeProgress, setRouteProgress] = useState<
    Map<string, { text: string; percent?: number }>
  >(new Map());
  const [selectedRouteForExport, setSelectedRouteForExport] = useState<
    string | null
  >(null);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportingRouteId, setExportingRouteId] = useState<string | null>(null);

  useEffect(() => {
    const load = () => void routesStore.loadRoutes();
    load();
    window.addEventListener('offline-routes-changed', load);
    return () => window.removeEventListener('offline-routes-changed', load);
  }, [routesStore.loadRoutes]);

  const runRouteAction = async (
    routeId: string,
    action: () => Promise<void>
  ) => {
    if (loadingActions.has(routeId)) return;
    setLoadingActions(previous => new Set(previous).add(routeId));
    try {
      await action();
    } finally {
      setLoadingActions(previous => {
        const next = new Set(previous);
        next.delete(routeId);
        return next;
      });
    }
  };

  const handleImport = async () => {
    if (!importRoadbook) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const message = await importRoadbook();
      if (message) setImportMessage(message);
      await routesStore.loadRoutes();
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : 'Import fehlgeschlagen.'
      );
    } finally {
      setImporting(false);
    }
  };

  const openRoute = (route: UserRoute) =>
    runRouteAction(route.id, async () => {
      const hasRenderedRoadbook = await offlineCache.hasRoadbookPdfAndIndex(
        route.id
      );
      if (!hasRenderedRoadbook) {
        await cacheRoadbookForOffline({
          routeId: route.id,
          routeName: route.name,
          profile: route.profile,
          fallbackMessage: t('common.loading'),
          onProgress: progress =>
            setRouteProgress(previous =>
              new Map(previous).set(route.id, progress)
            ),
        });
      }
      setRouteProgress(previous => {
        const next = new Map(previous);
        next.delete(route.id);
        return next;
      });
      const store = useAppStore.getState();
      store.setCurrentRouteId(route.id);
      store.setCurrentRouteName(route.name);
      store.setRouteProfile(route.profile);
      navigate(buildRoadbookPath(route.id, route.name));
    }).catch(error =>
      alert(
        `Failed to load route: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );

  const editRoute = (route: UserRoute) => {
    const view = getRoutePlanningView(route.waypoints);
    if (view) setRouteBuilderMapView(view);
    resetRouteBuilder();
    navigate(buildRoutePlanningPath(route.id));
  };

  const deleteRoute = (routeId: string) =>
    runRouteAction(routeId, async () => {
      await Promise.all([
        routesStore.deleteRoute(routeId),
        offlineCache.deleteRoadbook(routeId),
      ]);
      if (routeId === currentRouteId) {
        setCurrentRouteId(null);
        setCurrentRouteName(null);
      }
    }).catch(error =>
      alert(
        `Failed to delete route: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );

  const exportRoute = async () => {
    if (!selectedRouteForExport) return;
    setExportingRouteId(selectedRouteForExport);
    try {
      await exportRoadbook({
        routeId: selectedRouteForExport,
        exportType: exportFormat,
      });
      setSelectedRouteForExport(null);
    } catch (error) {
      alert(
        `Export fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    } finally {
      setExportingRouteId(null);
    }
  };

  const routes = filterAndSortRoutes(routesStore.routes, filter, sort);

  if (routesStore.isLoading && routesStore.routes.length === 0) {
    return (
      <VStack height="100%" justify="center" bg={bgColor}>
        <Spinner size="lg" />
        <Text>{t('common.loading')}</Text>
      </VStack>
    );
  }

  return (
    <>
      <Box p={6} bg={bgColor} height="100%" overflow="auto">
        <Button mb={4} loading={importing} onClick={handleImport}>
          {t('routeBuilder:labels.openRn2', { defaultValue: 'Öffnen (.rn2)' })}
        </Button>
        {importMessage && <Text mb={4}>{importMessage}</Text>}

        {routesStore.routes.length > 0 && (
          <>
            <Heading as="h2" size="lg" mb={6}>
              {t('routeBuilder:labels.savedRoutes')} (
              {routesStore.routes.length})
            </Heading>
            <HStack mb={4} flexWrap="wrap">
              <Input
                flex="1"
                minW="180px"
                aria-label={t('routeBuilder:labels.filterName')}
                placeholder={t('routeBuilder:labels.filterName')}
                value={filter}
                onChange={event => setFilter(event.target.value)}
              />
              <NativeSelect.Root width="auto">
                <NativeSelect.Field
                  aria-label={t('routeBuilder:labels.sortRoutes')}
                  value={sort}
                  onChange={event => setSort(event.target.value)}
                >
                  {[
                    'date-desc',
                    'date-asc',
                    'name-asc',
                    'name-desc',
                    'length-asc',
                    'length-desc',
                  ].map(value => (
                    <option key={value} value={value}>
                      {t(`routeBuilder:labels.sort.${value}`)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
          </>
        )}

        {routesStore.error && <Text color="red.600">{routesStore.error}</Text>}
        {routesStore.routes.length === 0 ? (
          <EmptyState
            onCreateRoute={() => navigate(buildRoutePlanningPath())}
          />
        ) : routes.length === 0 ? (
          <Text>{t('routeBuilder:labels.noMatches')}</Text>
        ) : (
          <VStack gap={4} align="stretch">
            {routes.map(route => {
              const progress = routeProgress.get(route.id);
              return (
                <RouteItem
                  key={route.id}
                  route={route}
                  isLoading={loadingActions.has(route.id)}
                  loadingText={
                    progress?.percent === undefined
                      ? progress?.text
                      : `${progress.text} (${progress.percent}%)`
                  }
                  onLoadAndNavigate={() => void openRoute(route)}
                  onEdit={() => editRoute(route)}
                  onExport={() => setSelectedRouteForExport(route.id)}
                  onDelete={() => void deleteRoute(route.id)}
                />
              );
            })}
          </VStack>
        )}
      </Box>

      <Dialog.Root
        open={selectedRouteForExport !== null}
        onOpenChange={event =>
          !event.open && !exportingRouteId && setSelectedRouteForExport(null)
        }
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('routeBuilder:labels.exportRoute')}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <RadioGroup.Root
                  value={exportFormat}
                  onValueChange={event =>
                    event.value && setExportFormat(event.value)
                  }
                >
                  <VStack align="stretch" gap={2}>
                    {EXPORT_FORMATS.map(([value, label]) => (
                      <RadioGroup.Item key={value} value={value}>
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          {label.includes(':') ? t(label) : label}
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>
                    ))}
                  </VStack>
                </RadioGroup.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => setSelectedRouteForExport(null)}
                  disabled={exportingRouteId !== null}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  loading={exportingRouteId !== null}
                  onClick={exportRoute}
                >
                  {t('routeBuilder:labels.export')}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};

export default RoutesList;
