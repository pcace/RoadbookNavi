import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Spinner } from '@chakra-ui/react';
import { Turn, NavigationState } from '../types';
import { FeatureCollection, LineString, GeoJsonProperties } from 'geojson';
import { useAppStore } from '../stores/appStore';
import {
  buildRoadbookPath,
  getAppSectionFromPathname,
  parseRoadbookRouteRef,
} from '../utils/roadbookRoute';

const RoadbookNavi = lazy(() =>
  import('./Roadbook').then(module => ({ default: module.RoadbookNavi }))
);
const RouteBuilder = lazy(() =>
  import('./RouteBuilder/RouteBuilder').then(module => ({
    default: module.RouteBuilder,
  }))
);
const Settings = lazy(() =>
  import('./Settings/Settings').then(module => ({ default: module.Settings }))
);
const RoutesList = lazy(() =>
  import('./RoutesList').then(module => ({ default: module.RoutesList }))
);

const sectionFallback = (
  <Box height="100%" display="flex" alignItems="center" justifyContent="center">
    <Spinner size="lg" />
  </Box>
);

interface MainContentProps {
  // Roadbook props
  turns: Turn[];
  coordinates: [number, number, number][];
  currentDistance: number;
  navigation: NavigationState;
  currentRouteName: string;
  currentRouteId: string | null;

  // Route builder props
  onRouteGenerated: (
    routeData: FeatureCollection<LineString, GeoJsonProperties>,
    routeName: string,
    routeId?: string,
    waypoints?: { lat: number; lon: number }[],
    profile?: string
  ) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  turns,
  coordinates,
  currentDistance,
  navigation,
  currentRouteName,
  currentRouteId,
  onRouteGenerated,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { routeRef } = useParams<{ routeRef?: string }>();
  const setCurrentRouteId = useAppStore(state => state.setCurrentRouteId);
  const setCurrentRouteName = useAppStore(state => state.setCurrentRouteName);
  const path = getAppSectionFromPathname(location.pathname);
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set([path])
  );
  const hasExplicitRouteRef = Boolean(routeRef);
  const { routeId: routeIdFromUrl, routeName: routeNameFromUrl } =
    parseRoadbookRouteRef(routeRef);
  const effectiveRouteId = hasExplicitRouteRef
    ? routeIdFromUrl
    : currentRouteId;
  const effectiveRouteName = hasExplicitRouteRef
    ? currentRouteName || routeNameFromUrl || ''
    : currentRouteName;

  useEffect(() => {
    if (path !== 'roadbook' || !routeIdFromUrl) {
      return;
    }

    if (currentRouteId !== routeIdFromUrl) {
      setCurrentRouteId(routeIdFromUrl);
    }

    if (
      routeNameFromUrl &&
      (!currentRouteName || currentRouteId !== routeIdFromUrl)
    ) {
      setCurrentRouteName(routeNameFromUrl);
    }
  }, [
    currentRouteId,
    currentRouteName,
    path,
    routeIdFromUrl,
    routeNameFromUrl,
    setCurrentRouteId,
    setCurrentRouteName,
  ]);

  useEffect(() => {
    if (path !== 'roadbook' || !effectiveRouteId || !effectiveRouteName) {
      return;
    }

    const canonicalPath = buildRoadbookPath(
      effectiveRouteId,
      effectiveRouteName
    );
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [effectiveRouteId, effectiveRouteName, location.pathname, navigate, path]);

  useEffect(() => {
    setVisitedSections(current => {
      if (current.has(path)) return current;
      const next = new Set(current);
      next.add(path);
      return next;
    });

    if (path !== 'route-planning') return;

    // MapLibre keeps its WebGL context while the builder is hidden. Trigger a
    // resize after it becomes visible again so it can use the restored bounds
    // without rebuilding the map and reloading its style and sources.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [path]);

  const wasVisited = (section: string) =>
    path === section || visitedSections.has(section);

  return (
    <>
      {wasVisited('roadbook') && (
        <Box height="100%" display={path === 'roadbook' ? 'block' : 'none'}>
          <Suspense fallback={sectionFallback}>
            <RoadbookNavi
              coordinates={coordinates}
              currentDistance={currentDistance}
              className="main-roadbook"
              nextTurnIndex={turns.findIndex(
                (t: Turn) => t.id === navigation.nextTurn?.id
              )}
              routeName={effectiveRouteName}
              routeId={effectiveRouteId || undefined}
              // messages={navigation.messages}
            />
          </Suspense>
        </Box>
      )}

      {wasVisited('route-planning') && (
        <Box
          height="100%"
          overflow="hidden"
          display={path === 'route-planning' ? 'block' : 'none'}
        >
          <Suspense fallback={sectionFallback}>
            <RouteBuilder onRouteGenerated={onRouteGenerated} />
          </Suspense>
        </Box>
      )}

      {wasVisited('routes-list') && (
        <Box
          height="100%"
          overflow="hidden"
          display={path === 'routes-list' ? 'block' : 'none'}
        >
          <Suspense fallback={sectionFallback}>
            <RoutesList />
          </Suspense>
        </Box>
      )}

      {wasVisited('settings') && (
        <Box
          height="100%"
          overflow="auto"
          p={4}
          display={path === 'settings' ? 'block' : 'none'}
        >
          <Suspense fallback={sectionFallback}>
            <Settings />
          </Suspense>
        </Box>
      )}
    </>
  );
};
