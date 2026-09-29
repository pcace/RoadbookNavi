import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { calculateDistance } from '../utils/calcDistance';
import {
  GPSTracker,
  ScreenWakeLock,
  CompassTracker,
} from '../utils/gpsTracking';
import { NavigationState, Turn, GPSPosition } from '../types';
import { useAppStore } from '../stores/appStore';
import { useSettings } from '../stores/settingsStore';
import { useThemeManager } from '../hooks/useThemeManager';
import { MainContent } from '../components/MainContent';
import { NewFooter } from '../components/Footer';
import { FeatureCollection, LineString, GeoJsonProperties } from 'geojson';
import {
  buildRoadbookPath,
  getAppSectionFromPathname,
  parseRoadbookRouteRef,
} from '../utils/roadbookRoute';

const ROADBOOK_ROUTE_PREFIX = '/app/roadbook/';

// Reset navigation only when the selected roadbook changes. A URL-derived
// session key avoids resetting the odometer on every render or path update.
const getRoadbookSessionState = (pathname: string) => {
  const section = getAppSectionFromPathname(pathname);

  if (section !== 'roadbook') {
    return { section, routeId: null as string | null };
  }

  const routeRef = pathname.startsWith(ROADBOOK_ROUTE_PREFIX)
    ? pathname.slice(ROADBOOK_ROUTE_PREFIX.length)
    : null;

  return {
    section,
    routeId: parseRoadbookRouteRef(routeRef).routeId,
  };
};

const AppPage: React.FC = () => {
  useThemeManager();
  // Use stable selectors for each piece of state
  const turns = useAppStore(state => state.turns);
  const navigation = useAppStore(state => state.navigation);
  const route = useAppStore(state => state.route);
  const odometer = useAppStore(state => state.odometer);
  const autoFollow = useAppStore(state => state.autoFollow);
  const settings = useAppStore(state => state.settings);
  const currentRouteId = useAppStore(state => state.currentRouteId);
  const setOdometer = useAppStore(state => state.setOdometer);
  const resetOdometer = useAppStore(state => state.resetOdometer);
  const loadRoute = useAppStore(state => state.loadRoute);
  const currentRouteName = useAppStore(state => state.currentRouteName);
  const [gpsTracker] = useState(() => new GPSTracker());
  const [compassTracker] = useState(() => new CompassTracker());
  const [wakeLock] = useState(() => new ScreenWakeLock());
  const [error, setError] = useState<string | null>(null);

  // Get settings from the settings store
  const { app: appSettings, loadSettings } = useSettings();
  const setSettings = useAppStore(state => state.setSettings);

  // Router hooks for URL synchronization
  const navigate = useNavigate();
  const location = useLocation();

  // Store previous position for odometer calculation
  const previousPositionRef = useRef<GPSPosition | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const compassLastPushRef = useRef<number>(0);
  // Track the active roadbook so a switch to another route can be detected.
  const lastRoadbookSessionRef = useRef(
    getRoadbookSessionState(location.pathname)
  );

  const handleRouteGenerated = useCallback(
    (
      routeData: FeatureCollection<LineString, GeoJsonProperties>,
      routeName: string,
      routeId?: string,
      waypoints?: { lat: number; lon: number }[],
      profile?: string
    ) => {
      loadRoute(routeData, routeId, waypoints, profile, routeName);
      setError(null);
      navigate(buildRoadbookPath(routeId, routeName));
    },
    [loadRoute, navigate]
  );

  const routeCoordinates = route
    ? route.features[0].geometry.coordinates.map(
        coord => [coord[0], coord[1], coord[2] ?? 0] as [number, number, number]
      )
    : [];

  const mainContentProps = {
    turns,
    coordinates: routeCoordinates,
    currentDistance: odometer,
    navigation,
    currentRouteName: currentRouteName || '',
    currentRouteId,
    onRouteGenerated: handleRouteGenerated,
  };

  // Load locally persisted settings when the application starts.
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Sync settings from settingsStore to appStore when they change
  useEffect(() => {
    setSettings(appSettings);
  }, [appSettings, setSettings]);

  useEffect(() => {
    const currentRoadbookSession = getRoadbookSessionState(location.pathname);
    const previousRoadbookSession = lastRoadbookSessionRef.current;

    const shouldResetForRoadbookLoad =
      currentRoadbookSession.section === 'roadbook' &&
      currentRoadbookSession.routeId &&
      (previousRoadbookSession.section !== 'roadbook' ||
        previousRoadbookSession.routeId !== currentRoadbookSession.routeId);

    if (shouldResetForRoadbookLoad) {
      // A newly selected roadbook starts with a fresh odometer.
      resetOdometer();
      // Clear the last GPS reference so the next fix cannot add distance from
      // the previously selected route.
      previousPositionRef.current = null;
    }

    lastRoadbookSessionRef.current = currentRoadbookSession;
  }, [location.pathname, resetOdometer]);

  // Define GPS handlers with useCallback to prevent unnecessary re-registrations
  const calculateNavigation = useCallback(
    (position: GPSPosition): NavigationState => {
      const currentTurns = useAppStore.getState().turns;
      const currentOdometer = useAppStore.getState().odometer;

      if (currentTurns.length === 0) {
        return {
          currentPosition: position,
          distanceToNextTurn: 0,
          isOnRoute: false,
          routeProgress: 0,
        };
      }

      // Find next turn based on odometer reading
      let nextTurn: Turn | undefined;
      let nextTurnIndex = -1;
      let distanceToNextTurn = Number.MAX_VALUE;

      // Find the next turn that's ahead of us on the route
      for (let i = 0; i < currentTurns.length; i++) {
        const turn = currentTurns[i];
        const distanceAlongRoute = turn.distanceFromStart - currentOdometer;

        if (distanceAlongRoute > -50) {
          nextTurn = turn;
          nextTurnIndex = i;
          const turnPoint = turn.points[0];
          distanceToNextTurn = calculateDistance(
            position.latitude,
            position.longitude,
            turnPoint.latitude,
            turnPoint.longitude
          );
          break;
        }
      }

      // Fallback: if no turn found using odometer, use closest turn
      if (!nextTurn) {
        const turnDistances = currentTurns.map((turn, index) => {
          const turnPoint = turn.points[0];
          return {
            turn,
            index,
            distance: calculateDistance(
              position.latitude,
              position.longitude,
              turnPoint.latitude,
              turnPoint.longitude
            ),
          };
        });

        turnDistances.sort((a, b) => a.distance - b.distance);
        const closestTurn = turnDistances[0];
        nextTurn = closestTurn.turn;
        nextTurnIndex = closestTurn.index;
        distanceToNextTurn = closestTurn.distance;
      }
      // Calculate route progress
      let routeProgress = 0;
      if (currentTurns.length > 0) {
        const totalDistance =
          currentTurns[currentTurns.length - 1].distanceFromStart;
        routeProgress = Math.min(
          1.0,
          Math.max(0, currentOdometer / totalDistance)
        );
      }

      return {
        currentPosition: position,
        nextTurn,
        nextTurnIndex,
        distanceToNextTurn,
        isOnRoute: distanceToNextTurn < 10,
        routeProgress,
      };
    },
    []
  );

  const handlePositionUpdate = useCallback(
    (position: GPSPosition) => {
      const store = useAppStore.getState();

      const prev = previousPositionRef.current;
      let moving = false;
      if (prev) {
        const dt = (position.timestamp - prev.timestamp) / 1000; // seconds between fixes

        // Coordinate-based distance (straight line / chord)
        const coordDistance = calculateDistance(
          prev.latitude,
          prev.longitude,
          position.latitude,
          position.longitude
        );

        // Derive speed from coordinates as fallback when the device doesn't report it
        const derivedSpeed = dt > 0 ? coordDistance / dt : 0;
        const speedMps = position.speed ?? derivedSpeed; // m/s

        const acc = position.accuracy ?? Infinity; // meters

        // Prefer Doppler-based speed integration (speed × Δt) over chord distance:
        // it approximates the actual arc length along curves and is more accurate
        // on GPS chips that report speed via Doppler even if coordinate fixes are sparse.
        const distanceMoved =
          position.speed !== null && position.speed !== undefined && dt > 0
            ? position.speed * dt
            : coordDistance;

        // Accuracy threshold scales with dt: longer gaps (tunnel, signal loss)
        // allow a looser threshold because the GPS chip needs time to re-acquire
        // satellites and the first fix after a gap typically has high accuracy values.
        // Cap at 4000 m to prevent runaway drift on very long outages.
        const maxAcc = Math.min(500 + dt * 50, 4000);

        // Gate: only count movement with meaningful speed and acceptable accuracy
        if (speedMps > 0.5 && acc < maxAcc) {
          store.incrementOdometer(distanceMoved);
          moving = true;
        } else {
          moving = false;
        }
      }
      store.setIsMoving(moving);

      // Optionally override heading with compass when not moving
      let enrichedPosition = position;
      if (!moving && compassHeadingRef.current !== null) {
        enrichedPosition = {
          ...position,
          heading: compassHeadingRef.current || undefined,
        };
      }

      // Only advance the reference position while moving (or on first fix).
      // If we updated it during standstill the next moving fix would include
      // the drift distance accumulated while standing still.
      if (moving || !previousPositionRef.current) {
        previousPositionRef.current = enrichedPosition;
      }

      // Keep navigation and GPS state updates
      const newNavigation = calculateNavigation(enrichedPosition);
      store.setNavigation(newNavigation);
      store.setGpsPosition(enrichedPosition);
    },
    [calculateNavigation]
  );

  const handleGPSError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = `GPS Fehler: ${error.message}`;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage +=
          ' - Zugriff verweigert. Bitte die Standortberechtigung in den Systemeinstellungen erlauben.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage += ' - Position nicht verfügbar';
        break;
      case error.TIMEOUT:
        errorMessage += ' - Timeout';
        break;
    }

    console.error(errorMessage);
    setError(errorMessage);
  }, []);

  // GPS tracking setup - always active
  useEffect(() => {
    gpsTracker.onPositionUpdate(handlePositionUpdate);
    gpsTracker.onError(handleGPSError);

    // Start GPS tracking
    gpsTracker.startTracking();

    if (settings.keepScreenOn) {
      wakeLock.request();
    }

    // Register compass heading callback (always, so it is ready when tracking starts)
    if (CompassTracker.isSupported()) {
      compassTracker.onHeadingUpdate(heading => {
        const norm = heading % 360;
        const h = norm < 0 ? norm + 360 : norm;
        compassHeadingRef.current = h;

        // While standing still, push compass heading into gpsPosition to keep UI responsive
        const now = Date.now();
        const last = compassLastPushRef.current;
        // Throttle to ~10 Hz
        if (now - last >= 100) {
          const store = useAppStore.getState();
          const isMoving = store.isMoving ?? false;
          const current = store.navigation.currentPosition;
          if (!isMoving && current) {
            const enriched: GPSPosition = { ...current, heading: h };
            store.setGpsPosition(enriched);
          }
          compassLastPushRef.current = now;
        }
      });

      // Android / non-iOS: no permission API → start immediately
      if (!CompassTracker.requiresPermission()) {
        compassTracker.startTracking();
      }
    }

    // iOS 13+: DeviceOrientationEvent.requestPermission() MUST be called from
    // inside a synchronous user-gesture handler – calling it during useEffect
    // (outside a gesture) causes the dialog to be skipped or shown unreliably.
    // We therefore defer it to the first user interaction.
    let gestureHandled = false;
    const onFirstUserGesture = async () => {
      if (gestureHandled) return;
      gestureHandled = true;
      try {
        if (
          CompassTracker.isSupported() &&
          CompassTracker.requiresPermission()
        ) {
          const granted = await CompassTracker.requestPermission();
          if (granted) {
            compassTracker.startTracking();
          }
        }
      } catch {
        // ignore – compass simply won't be used
      }
      document.removeEventListener('pointerdown', onFirstUserGesture);
      document.removeEventListener('touchstart', onFirstUserGesture);
      document.removeEventListener('click', onFirstUserGesture);
    };
    document.addEventListener('pointerdown', onFirstUserGesture, {
      once: true,
    });
    document.addEventListener('touchstart', onFirstUserGesture, { once: true });
    document.addEventListener('click', onFirstUserGesture, { once: true });

    return () => {
      gpsTracker.stopTracking();
      gpsTracker.removeCallbacks();
      compassTracker.stopTracking();
      compassTracker.removeCallbacks();
      wakeLock.release();
      document.removeEventListener('pointerdown', onFirstUserGesture);
      document.removeEventListener('touchstart', onFirstUserGesture);
      document.removeEventListener('click', onFirstUserGesture);
    };
  }, [handlePositionUpdate, handleGPSError, settings.keepScreenOn]);

  // Keyboard handlers for odometer control when auto-follow is enabled
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keys in the roadbook view
      if (getAppSectionFromPathname(location.pathname) !== 'roadbook') return;

      // Use configurable keys for odometer control when auto-follow is enabled
      if (
        autoFollow &&
        (event.key === settings.odometerIncreaseKey ||
          event.key === settings.odometerDecreaseKey)
      ) {
        event.preventDefault();

        const step = 10; // 10m steps
        const newOdometer =
          event.key === settings.odometerIncreaseKey
            ? odometer + step
            : Math.max(0, odometer - step);

        setOdometer(newOdometer);
      }
    };

    if (autoFollow) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    autoFollow,
    location.pathname,
    odometer,
    setOdometer,
    settings.odometerIncreaseKey,
    settings.odometerDecreaseKey,
  ]);

  return (
    <Box
      className="app"
      width="100%"
      display="flex"
      flexDirection="column"
      style={{
        height: 'calc(var(--vh, 1vh) * 100)' /* Use our custom variable */,
        overflow: 'hidden' /* Prevent scrolling */,
      }}
    >
      {error && (
        <Box className="error-banner" width="100%">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </Box>
      )}

      {!GPSTracker.isSupported() && (
        <Box className="warning" width="100%">
          ⚠️ GPS wird von diesem Browser nicht unterstützt
        </Box>
      )}

      <>
        <Box flex="1" overflow="hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/app/roadbook" replace />} />
            <Route
              path="/roadbook/:routeRef"
              element={<MainContent {...mainContentProps} />}
            />
            <Route
              path="/roadbook"
              element={<MainContent {...mainContentProps} />}
            />
            <Route
              path="/route-planning/:editRouteId/edit"
              element={<MainContent {...mainContentProps} />}
            />
            <Route
              path="/route-planning"
              element={<MainContent {...mainContentProps} />}
            />
            <Route
              path="/routes-list"
              element={<MainContent {...mainContentProps} />}
            />
            <Route
              path="/settings"
              element={<MainContent {...mainContentProps} />}
            />
          </Routes>
        </Box>
        <NewFooter />
      </>
    </Box>
  );
};

export default AppPage;
