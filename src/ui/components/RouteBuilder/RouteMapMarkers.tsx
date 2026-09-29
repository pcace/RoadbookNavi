import React from 'react';
import { Box } from '@chakra-ui/react';
import { Marker } from 'react-map-gl/maplibre';
import type { RoutePoint } from './types';

interface RouteMapMarkersProps {
  isLoading: boolean;
  routePoints: RoutePoint[];
  onMarkerClick: (pointId: string, event: any) => void;
  onMarkerDrag: (event: any) => void;
  onMarkerDragEnd: (pointId: string, event: any) => void;
  onMarkerDragStart: (pointId: string) => void;
}

export const RouteMapMarkers: React.FC<RouteMapMarkersProps> = ({
  isLoading,
  routePoints,
  onMarkerClick,
  onMarkerDrag,
  onMarkerDragEnd,
  onMarkerDragStart,
}) => {
  return (
    <>
      {routePoints.map((point, index) => {
        const markerColor = point.color || '#3498DB';

        return (
          <Marker
            key={`marker-${point.id}-${index}-${routePoints.length}-${markerColor}`}
            longitude={point.lon}
            latitude={point.lat}
            draggable={!isLoading}
            onClick={
              !isLoading ? event => onMarkerClick(point.id, event) : undefined
            }
            onDragStart={
              !isLoading ? () => onMarkerDragStart(point.id) : undefined
            }
            onDrag={!isLoading ? onMarkerDrag : undefined}
            onDragEnd={
              !isLoading ? event => onMarkerDragEnd(point.id, event) : undefined
            }
          >
            <Box
              width="20px"
              height="20px"
              borderRadius="50%"
              backgroundColor={markerColor}
              border="2px solid white"
              boxShadow="0 2px 4px rgba(0,0,0,0.3)"
              cursor={!isLoading ? 'pointer' : 'default'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="10px"
              fontWeight="bold"
              color="white"
              style={{ backgroundColor: markerColor }}
              _hover={
                !isLoading
                  ? {
                      transform: 'scale(1.1)',
                      transition: 'transform 0.2s ease',
                    }
                  : {}
              }
            >
              {index + 1}
            </Box>
          </Marker>
        );
      })}
    </>
  );
};
