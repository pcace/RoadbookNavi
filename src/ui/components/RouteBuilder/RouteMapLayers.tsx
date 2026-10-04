import React from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString, Point } from 'geojson';

interface RouteMapLayersProps {
  effectiveLoadingRouteData: FeatureCollection<LineString> | null;
  gpxUnderlay: FeatureCollection<LineString> | null;
  hoveredSurfaceKey: string | null;
  loadingRouteData: FeatureCollection<LineString> | null;
  normalizedRouteData: FeatureCollection<LineString> | null;
  routeLineColor: any;
  turnPoints: FeatureCollection<Point> | null;
}

export const RouteMapLayers: React.FC<RouteMapLayersProps> = ({
  effectiveLoadingRouteData,
  gpxUnderlay,
  hoveredSurfaceKey,
  loadingRouteData,
  normalizedRouteData,
  routeLineColor,
  turnPoints,
}) => {
  return (
    <>
      {gpxUnderlay && gpxUnderlay.features && gpxUnderlay.features[0] && (
        <Source id="gpx-underlay" type="geojson" data={gpxUnderlay}>
          <Layer
            id="gpx-underlay-line"
            type="line"
            paint={{
              'line-color': '#333333',
              'line-width': 3,
              'line-opacity': 0.7,
              'line-dasharray': [2, 1],
            }}
          />
        </Source>
      )}

      {effectiveLoadingRouteData &&
        effectiveLoadingRouteData.features &&
        effectiveLoadingRouteData.features[0] && (
          <Source
            id="loading-route"
            type="geojson"
            data={effectiveLoadingRouteData}
          >
            <Layer
              id="loading-route-line"
              type="line"
              paint={{
                'line-color': '#999999',
                'line-width': 3,
                'line-opacity': 0.7,
                'line-dasharray': [2, 2],
              }}
            />
          </Source>
        )}

      {normalizedRouteData &&
        normalizedRouteData.features &&
        normalizedRouteData.features[0] &&
        !effectiveLoadingRouteData && (
          <Source id="route" type="geojson" data={normalizedRouteData}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': routeLineColor as any,
                'line-width': 4,
                'line-opacity': 0.9,
              }}
            />
            {hoveredSurfaceKey && (
              <Layer
                id="route-line-highlight"
                type="line"
                filter={[
                  '==',
                  [
                    'coalesce',
                    ['get', 'surface_norm'],
                    ['get', 'surface'],
                    'unknown',
                  ],
                  hoveredSurfaceKey,
                ]}
                paint={{
                  'line-color': '#fbbf24',
                  'line-width': 8,
                  'line-opacity': 1,
                }}
              />
            )}
          </Source>
        )}

      {turnPoints &&
        turnPoints.features &&
        turnPoints.features.length > 0 &&
        !loadingRouteData && (
          <Source id="turn-points" type="geojson" data={turnPoints}>
            <Layer
              id="turn-points-circles"
              type="circle"
              paint={{
                'circle-radius': 4,
                'circle-color': 'rgba(124,52,2,1)',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 1,
              }}
            />
          </Source>
        )}
    </>
  );
};
