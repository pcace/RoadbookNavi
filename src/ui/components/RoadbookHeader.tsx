import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, HStack, Stack } from '@chakra-ui/react';
import { bearing as turfBearing, distance as turfDistance } from '@turf/turf';
import { useRoadbookHeaderColors } from '../theme/colors';
import { useColorModeValue } from './ui/color-mode';
import { useAppStore, useGpsPosition } from '../stores/appStore';
import { Odometer } from './Odometer';

interface RoadbookHeaderProps {
  // Header state
  isHeaderExpanded: boolean;
  isLandscape: boolean;
}

type MiddleColumnMode = 'next' | 'speed' | 'gps' | 'finish' | 'north' | 'cap';

const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${meters.toFixed(0)}m`;

  return `${(meters / 1000).toFixed(1)}km`;
};

const ArrowIcon: React.FC<{ angleDeg: number; color: string }> = React.memo(
  ({ angleDeg, color }) => (
    <Box
      position="relative"
      height="50px"
      width="50px"
      transform={`rotate(${angleDeg}deg)`}
      color={color}
    >
      <svg viewBox="0 0 24 28" fill="currentColor" width="100%" height="100%">
        <path d="M12 2L18 10L14 10L14 26L10 26L10 10L6 10L12 2Z" />
      </svg>
    </Box>
  )
);

ArrowIcon.displayName = 'ArrowIcon';

const NextTargetView: React.FC<{
  arrowTextColor: string;
  accentColor: string;
  navigationAngle: number;
  distanceToNextTurn: number;
  nextMarkerIndex: number | null;
}> = React.memo(
  ({
    arrowTextColor,
    accentColor,
    navigationAngle,
    distanceToNextTurn,
    nextMarkerIndex,
  }) => (
    <>
      <HStack gap={4} alignItems="center" justifyContent="center">
        <Stack gap={0} alignItems="center">
          <Text
            fontWeight="bold"
            color={arrowTextColor}
            opacity={0.9}
            lineHeight={1.1}
            textAlign="center"
            css={{
              fontSize: 'clamp(0.85rem, 3vw, 1.1rem)',
              '@media (orientation: landscape)': {
                fontSize: 'clamp(0.8rem, 2vw, 1rem)',
              },
            }}
          >
            {typeof nextMarkerIndex === 'number' ? `#${nextMarkerIndex}` : '—'}
          </Text>

          <Text
            fontWeight="bold"
            lineHeight={1}
            color={arrowTextColor}
            textAlign="center"
            css={{
              fontSize: 'clamp(1.8rem, 7vw, 3rem)',
              '@media (orientation: landscape)': {
                fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
              },
            }}
          >
            {formatDistance(distanceToNextTurn)}
          </Text>
        </Stack>

        <ArrowIcon angleDeg={navigationAngle} color={accentColor} />
      </HStack>
    </>
  )
);

NextTargetView.displayName = 'NextTargetView';

const SpeedView: React.FC<{ arrowTextColor: string; speedKmh: number | null }> =
  React.memo(({ arrowTextColor, speedKmh }) => (
    <>
      <HStack gap={1} alignItems="baseline" justifyContent="center">
        <Text
          fontWeight="bold"
          color={arrowTextColor}
          css={{
            fontSize: 'clamp(1.2rem, 5vw, 2rem)',
            '@media (orientation: landscape)': {
              fontSize: 'clamp(1.1rem, 3vw, 1.8rem)',
            },
          }}
        >
          {speedKmh == null ? '—' : speedKmh.toFixed(1)}
        </Text>
        {speedKmh != null && (
          <Text
            fontWeight="bold"
            color={arrowTextColor}
            opacity={0.9}
            css={{
              fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
              '@media (orientation: landscape)': {
                fontSize: 'clamp(0.7rem, 1.6vw, 0.95rem)',
              },
            }}
          >
            km/h
          </Text>
        )}
      </HStack>
    </>
  ));

SpeedView.displayName = 'SpeedView';

const GpsView: React.FC<{
  arrowTextColor: string;
  latitude: number | null;
  longitude: number | null;
}> = React.memo(({ arrowTextColor, latitude, longitude }) => (
  <>
    {latitude == null || longitude == null ? (
      <Text fontWeight="bold" color={arrowTextColor}>
        —
      </Text>
    ) : (
      <Stack gap={0} alignItems="center">
        <Text
          fontWeight="bold"
          color={arrowTextColor}
          textAlign="center"
          lineHeight={1.1}
          css={{
            fontSize: 'clamp(1.2rem, 4.4vw, 1.8rem)',
            '@media (orientation: landscape)': {
              fontSize: 'clamp(1.1rem, 2.8vw, 1.6rem)',
            },
          }}
        >
          {latitude.toFixed(5)}
        </Text>
        <Text
          fontWeight="bold"
          color={arrowTextColor}
          textAlign="center"
          lineHeight={1.1}
          css={{
            fontSize: 'clamp(1.2rem, 4.4vw, 1.8rem)',
            '@media (orientation: landscape)': {
              fontSize: 'clamp(1.1rem, 2.8vw, 1.6rem)',
            },
          }}
        >
          {longitude.toFixed(5)}
        </Text>
      </Stack>
    )}
  </>
));

GpsView.displayName = 'GpsView';

const FinishView: React.FC<{
  arrowTextColor: string;
  accentColor: string;
  angleDeg: number | null;
  distanceMeters: number | null;
}> = React.memo(({ arrowTextColor, accentColor, angleDeg, distanceMeters }) => (
  <>
    <HStack gap={4} alignItems="center" justifyContent="center">
      <Stack gap={0} alignItems="flex-start">
        <Text
          fontWeight="bold"
          color={arrowTextColor}
          opacity={0.9}
          css={{
            fontSize: 'clamp(0.75rem, 2.2vw, 0.95rem)',
            '@media (orientation: landscape)': {
              fontSize: 'clamp(0.7rem, 1.6vw, 0.9rem)',
            },
          }}
        >
          Finish:
        </Text>

        <Text
          fontWeight="bold"
          lineHeight={1}
          color={arrowTextColor}
          css={{
            fontSize: 'clamp(1.6rem, 6vw, 2.6rem)',
            '@media (orientation: landscape)': {
              fontSize: 'clamp(1.4rem, 3.6vw, 2.2rem)',
            },
          }}
        >
          {distanceMeters == null ? '—' : formatDistance(distanceMeters)}
        </Text>
      </Stack>

      {angleDeg == null ? (
        <Text fontWeight="bold" color={arrowTextColor}>
          —
        </Text>
      ) : (
        <ArrowIcon angleDeg={angleDeg} color={accentColor} />
      )}
    </HStack>
  </>
));

FinishView.displayName = 'FinishView';

const CapView: React.FC<{ textColor: string; bearingDeg: number }> = React.memo(
  ({ textColor, bearingDeg }) => (
    <Box display="inline-flex" alignItems="center" justifyContent="center">
      <Text
        fontWeight="bold"
        color={textColor}
        lineHeight={1}
        textAlign="center"
        css={{
          // Slightly smaller than before, stays nicely centered in the field
          fontSize: 'clamp(1.8rem, 7vw, 3.6rem)',
          '@media (orientation: landscape)': {
            fontSize: 'clamp(2.2rem, 4.2vw, 4.2rem)',
          },
          '@media (orientation: portrait)': {
            fontSize: 'clamp(1.8rem, 8.5vw, 3.6rem)',
          },
        }}
      >
        {Math.round(bearingDeg)}°
      </Text>
    </Box>
  )
);

CapView.displayName = 'CapView';

const NorthView: React.FC<{
  arrowTextColor: string;
  accentColor: string;
  angleDeg: number;
}> = React.memo(({ arrowTextColor, accentColor, angleDeg }) => (
  <Box position="relative" width="100%" height="50px">
    <Box position="absolute" left="50%" top="0" transform="translateX(-50%)">
      <ArrowIcon angleDeg={angleDeg} color={accentColor} />
    </Box>

    <Box
      position="absolute"
      left="50%"
      top="50%"
      transform="translate(34px, -50%)"
    >
      <Text fontWeight="bold" color={arrowTextColor}>
        N
      </Text>
    </Box>
  </Box>
));

NorthView.displayName = 'NorthView';

// Separate component for navigation info to prevent unnecessary re-renders
const NavigationInfo: React.FC = React.memo(() => {
  const gpsPosition = useGpsPosition();
  const navigation = useAppStore(state => state.navigation);
  const odometer = useAppStore(state => state.odometer);
  const roadbookIndex = useAppStore(state => state.roadbookIndex);
  const currentRoadbookIndex = useAppStore(state => state.currentRoadbookIndex);
  const route = useAppStore(state => state.route);
  const { accentColor, headingBg, textColor, arrowTextColor } =
    useRoadbookHeaderColors();

  const bgNext = useColorModeValue('blue.50', 'blue.900');
  const bgSpeed = useColorModeValue('green.50', 'green.900');
  const bgGps = useColorModeValue('purple.50', 'purple.900');
  const bgFinish = useColorModeValue('orange.50', 'orange.900');
  const bgNorth = useColorModeValue('cyan.50', 'cyan.900');

  const [middleMode, setMiddleMode] = useState<MiddleColumnMode>('next');
  const cycleMiddleMode = useCallback(() => {
    const modes: MiddleColumnMode[] = [
      'next',
      'speed',
      'gps',
      'finish',
      'north',
      'cap',
    ];
    setMiddleMode(prev => {
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  const middleBg = useMemo(() => {
    switch (middleMode) {
      case 'next':
        return bgNext;
      case 'speed':
        return bgSpeed;
      case 'gps':
        return bgGps;
      case 'finish':
        return bgFinish;
      case 'north':
        return bgNorth;
      case 'cap':
        return headingBg;
    }
  }, [bgFinish, bgGps, bgNext, bgNorth, bgSpeed, headingBg, middleMode]);

  // Extract currentSpeed and bearing from gpsPosition
  const bearing = gpsPosition?.heading || 0;

  // Calculate next target position and distance.
  // Prefer lightweight PDF index navigation (lat/lng + marker index).
  // Distance is always the direct GPS-to-target distance (turfDistance).
  // Fall back to route-based navigation if the index isn't available.
  const { nextTurnPosition, distanceToNextTurn, nextMarkerIndex } =
    useMemo(() => {
      if (gpsPosition && roadbookIndex.length > 0) {
        const nextByMarker =
          typeof currentRoadbookIndex === 'number'
            ? roadbookIndex.find(e => e.index === currentRoadbookIndex)
            : undefined;

        let target = nextByMarker;
        if (!target) {
          // Find first entry with distance >= current odometer
          let lo = 0;
          let hi = roadbookIndex.length - 1;
          let pos = roadbookIndex.length;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (roadbookIndex[mid].distance >= odometer) {
              pos = mid;
              hi = mid - 1;
            } else {
              lo = mid + 1;
            }
          }
          target = roadbookIndex[pos];
        }

        if (target) {
          const nextPos = { latitude: target.lat, longitude: target.lng };
          const directDistance = turfDistance(
            [gpsPosition.longitude, gpsPosition.latitude],
            [nextPos.longitude, nextPos.latitude],
            { units: 'meters' }
          );

          return {
            nextTurnPosition: nextPos,
            distanceToNextTurn: directDistance,
            nextMarkerIndex: target.index,
          };
        }
      }

      const nextTurn = navigation.nextTurn;
      if (!gpsPosition || !nextTurn || nextTurn.points.length === 0) {
        return {
          nextTurnPosition: undefined,
          distanceToNextTurn: 0,
          nextMarkerIndex: null,
        };
      }

      const turnPoint = nextTurn.points[0];
      const nextTurnPos = {
        latitude: turnPoint.latitude,
        longitude: turnPoint.longitude,
      };

      const distanceToNext = turfDistance(
        [gpsPosition.longitude, gpsPosition.latitude],
        [turnPoint.longitude, turnPoint.latitude],
        { units: 'meters' }
      );

      return {
        nextTurnPosition: nextTurnPos,
        distanceToNextTurn: distanceToNext,
        nextMarkerIndex: null,
      };
    }, [
      currentRoadbookIndex,
      gpsPosition,
      navigation.nextTurn,
      odometer,
      roadbookIndex,
    ]);

  const { distanceToFinish, finishAngle } = useMemo(() => {
    if (!gpsPosition) {
      return { distanceToFinish: null, finishAngle: null };
    }

    let finishLat: number | null = null;
    let finishLng: number | null = null;

    if (roadbookIndex.length > 0) {
      const last = roadbookIndex[roadbookIndex.length - 1];
      finishLat = last?.lat ?? null;
      finishLng = last?.lng ?? null;
    } else if (route?.features?.length) {
      const lastLine = route.features.find(
        f => f.geometry?.type === 'LineString'
      );
      const coords =
        lastLine && lastLine.geometry.type === 'LineString'
          ? lastLine.geometry.coordinates
          : null;
      const lastCoord =
        coords && coords.length ? coords[coords.length - 1] : null;
      if (
        lastCoord &&
        typeof lastCoord[0] === 'number' &&
        typeof lastCoord[1] === 'number'
      ) {
        finishLng = lastCoord[0];
        finishLat = lastCoord[1];
      }
    }

    if (finishLat == null || finishLng == null) {
      return { distanceToFinish: null, finishAngle: null };
    }

    const from: [number, number] = [
      gpsPosition.longitude,
      gpsPosition.latitude,
    ];
    const to: [number, number] = [finishLng, finishLat];
    const distance = turfDistance(from, to, { units: 'meters' });
    const bearingToFinish = turfBearing(from, to);

    let relativeAngle = bearingToFinish - bearing;
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    return {
      distanceToFinish: distance,
      finishAngle: relativeAngle,
    };
  }, [bearing, gpsPosition, roadbookIndex, route]);

  const northAngle = useMemo(() => {
    let relativeAngle = 0 - bearing;
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;
    return relativeAngle;
  }, [bearing]);

  // Calculate navigation arrow angle
  const navigationAngle = useMemo((): number => {
    if (!gpsPosition || !nextTurnPosition) return 0;
    try {
      const from = [gpsPosition.longitude, gpsPosition.latitude];
      const to = [nextTurnPosition.longitude, nextTurnPosition.latitude];

      const bearingToTarget = turfBearing(from, to);
      // Convert to relative angle (relative to current heading)
      let relativeAngle = bearingToTarget - bearing;

      // Normalize to -180 to 180 range
      while (relativeAngle > 180) relativeAngle -= 360;
      while (relativeAngle < -180) relativeAngle += 360;

      return relativeAngle;
    } catch (error) {
      console.error('Error calculating navigation angle:', error);
      return 0;
    }
  }, [gpsPosition, nextTurnPosition, bearing]);

  return (
    <>
      {/* Right Field - Click-to-cycle views (merged: navigation + CAP) */}
      <HStack
        flex={1}
        direction="column"
        alignItems="center"
        justifyContent={
          middleMode === 'speed' ||
          middleMode === 'north' ||
          middleMode === 'cap'
            ? 'center'
            : 'flex-start'
        }
        onClick={cycleMiddleMode}
        cursor="pointer"
        userSelect="none"
        position="relative"
        background={middleBg}
        border="2px solid black"
        height="100%"
        width="100%"
      >
        <Box
          pt={
            middleMode === 'finish' ||
            middleMode === 'next' ||
            middleMode === 'gps' ||
            middleMode === 'cap'
              ? 0
              : 6
          }
          px={3}
          py={2}
          width="100%"
        >
          {middleMode === 'next' && nextTurnPosition && (
            <Box width="100%" display="flex" justifyContent="center">
              <NextTargetView
                arrowTextColor={arrowTextColor}
                accentColor={accentColor}
                navigationAngle={navigationAngle}
                distanceToNextTurn={distanceToNextTurn}
                nextMarkerIndex={nextMarkerIndex}
              />
            </Box>
          )}

          {middleMode === 'next' && !nextTurnPosition && (
            <Box width="100%" display="flex" justifyContent="center">
              <Text fontWeight="bold" color={arrowTextColor}>
                —
              </Text>
            </Box>
          )}

          {middleMode === 'speed' && (
            <SpeedView
              arrowTextColor={arrowTextColor}
              speedKmh={
                gpsPosition && typeof gpsPosition.speed === 'number'
                  ? gpsPosition.speed * 3.6
                  : null
              }
            />
          )}

          {middleMode === 'gps' && (
            <GpsView
              arrowTextColor={arrowTextColor}
              latitude={gpsPosition?.latitude ?? null}
              longitude={gpsPosition?.longitude ?? null}
            />
          )}

          {middleMode === 'finish' && (
            <FinishView
              arrowTextColor={arrowTextColor}
              accentColor={accentColor}
              angleDeg={finishAngle}
              distanceMeters={distanceToFinish}
            />
          )}

          {middleMode === 'north' && (
            <NorthView
              arrowTextColor={arrowTextColor}
              accentColor={accentColor}
              angleDeg={northAngle}
            />
          )}

          {middleMode === 'cap' && (
            <Box width="100%" display="flex" justifyContent="center">
              <CapView textColor={textColor} bearingDeg={bearing} />
            </Box>
          )}
        </Box>
      </HStack>
    </>
  );
});

NavigationInfo.displayName = 'NavigationInfo';

// Separate component for GPS info to prevent unnecessary re-renders
const GPSInfo: React.FC<{ isLandscape: boolean }> = React.memo(
  ({ isLandscape }) => {
    const gpsPosition = useGpsPosition();
    const infoBg = useColorModeValue('gray.800', 'gray.800');
    const whiteText = useColorModeValue('gray.100', 'gray.100');

    const currentSpeed = gpsPosition?.speed || 0;

    return (
      <Stack direction={isLandscape ? 'column' : 'row'} bg={infoBg}>
        <HStack>
          <Text
            fontWeight="bold"
            color={whiteText}
            css={{
              fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
            }}
          >
            Speed:
          </Text>
          <Text
            color={whiteText}
            css={{
              fontSize: 'clamp(1rem, 2vw, 0.875rem)',
            }}
          >
            {(currentSpeed * 3.6).toFixed(1)} km/h
          </Text>
        </HStack>

        {gpsPosition && (
          <HStack>
            <Text
              fontWeight="bold"
              color={whiteText}
              css={{
                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              }}
            >
              GPS:
            </Text>
            <Text
              color={whiteText}
              css={{
                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              }}
            >
              {gpsPosition.latitude.toFixed(5)},{' '}
              {gpsPosition.longitude.toFixed(5)}
            </Text>
          </HStack>
        )}
      </Stack>
    );
  }
);

GPSInfo.displayName = 'GPSInfo';

export const RoadbookHeader: React.FC<RoadbookHeaderProps> = ({
  isHeaderExpanded,
  isLandscape,
}) => {
  return (
    <>
      {isHeaderExpanded && (
        <Stack
          className="roadbook-header"
          direction={'column'}
          width={isLandscape ? '25%' : '100%'}
          height={isLandscape ? '100%' : 'auto'}
          minH={isLandscape ? 0 : undefined}
          align="stretch"
        >
          <Stack
            direction={isLandscape ? 'column' : 'row'}
            flex={isLandscape ? 1 : undefined}
            minH={isLandscape ? 0 : undefined}
            align="stretch"
          >
            {/* Left Column - Odometer Display */}
            <Odometer />

            {/* Navigation Info */}
            <NavigationInfo />
          </Stack>

          {/* GPS Info */}
          <Box flexShrink={0}>
            <GPSInfo isLandscape={isLandscape} />
          </Box>
        </Stack>
      )}
    </>
  );
};
