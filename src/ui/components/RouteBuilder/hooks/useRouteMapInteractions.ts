import { useMemo, useState } from 'react';
import type { FeatureCollection, LineString } from 'geojson';
import { circle, point } from '@turf/turf';
import { formatMeters } from '../utils/routeAnalysis';
import { normalizeSurfaceKey } from '../utils/surfaces';
import type { RoutePoint } from '../types';

interface UseRouteMapInteractionsArgs {
  addPoint: (lng: number, lat: number) => void;
  handleMarkerDragStart: (id: string) => void;
  handleRouteClick: (lng: number, lat: number) => void;
  handleRouteDragEnd: (pointId: string, lng: number, lat: number) => void;
  handleRouteDragMove: (pointId: string, lng: number, lat: number) => void;
  handleRouteMouseDown: (lng: number, lat: number) => string | null;
  isLoading: boolean;
  loadingRouteData: FeatureCollection<LineString> | null;
  maxDistanceKm: number;
  removePoint: (id: string) => void;
  routeData: FeatureCollection<LineString> | null;
  routePoints: RoutePoint[];
  t: (key: string, options?: any) => string;
  updatePoint: (id: string, lat: number, lng: number) => void;
}

export const useRouteMapInteractions = ({
  addPoint,
  handleMarkerDragStart,
  handleRouteClick,
  handleRouteDragEnd,
  handleRouteDragMove,
  handleRouteMouseDown,
  isLoading,
  loadingRouteData,
  maxDistanceKm,
  removePoint,
  routeData,
  routePoints,
  t,
  updatePoint,
}: UseRouteMapInteractionsArgs) => {
  const isRouteLineInteraction = (features?: any[]) =>
    Boolean(
      features?.some(
        feature =>
          feature?.layer?.id === 'route-line' ||
          feature?.layer?.id === 'route-line-highlight'
      )
    );

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [routeDraggingPointId, setRouteDraggingPointId] = useState<
    string | null
  >(null);
  const [pendingRouteClick, setPendingRouteClick] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [localDragPosition, setLocalDragPosition] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    surface: string;
    lengthText: string;
  } | null>(null);

  const effectiveRoutePoints = useMemo(() => {
    const activelyDraggingId = routeDraggingPointId || draggingPointId;

    if (!activelyDraggingId || !localDragPosition) {
      return routePoints;
    }

    return routePoints.map(point =>
      point.id === activelyDraggingId
        ? { ...point, ...localDragPosition }
        : point
    );
  }, [draggingPointId, localDragPosition, routeDraggingPointId, routePoints]);

  const effectiveLoadingRouteData = useMemo(() => {
    const activelyDraggingId = routeDraggingPointId || draggingPointId;

    if (!loadingRouteData || !activelyDraggingId || !localDragPosition) {
      return loadingRouteData;
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: effectiveRoutePoints.map(point => [
              point.lon,
              point.lat,
            ]),
          },
        },
      ],
    } as FeatureCollection<LineString>;
  }, [
    draggingPointId,
    effectiveRoutePoints,
    loadingRouteData,
    localDragPosition,
    routeDraggingPointId,
  ]);

  const maxDistanceCircle = useMemo(() => {
    const activelyDraggingId = routeDraggingPointId || draggingPointId;
    if (effectiveRoutePoints.length === 0 || activelyDraggingId) {
      return null;
    }

    const lastPoint = effectiveRoutePoints[effectiveRoutePoints.length - 1];
    const center = point([lastPoint.lon, lastPoint.lat]);

    return {
      type: 'FeatureCollection',
      features: [
        circle(center, maxDistanceKm, {
          steps: 64,
          units: 'kilometers',
        }),
      ],
    } as FeatureCollection;
  }, [
    draggingPointId,
    effectiveRoutePoints,
    maxDistanceKm,
    routeDraggingPointId,
  ]);

  const dragNeighborCircles = useMemo(() => {
    const activelyDraggingId = routeDraggingPointId || draggingPointId;
    if (!activelyDraggingId) {
      return null;
    }

    const pointIndex = effectiveRoutePoints.findIndex(
      point => point.id === activelyDraggingId
    );
    if (pointIndex === -1) {
      return null;
    }

    const circles = [];

    if (pointIndex > 0) {
      const prevPoint = effectiveRoutePoints[pointIndex - 1];
      circles.push(
        circle(point([prevPoint.lon, prevPoint.lat]), maxDistanceKm, {
          steps: 64,
          units: 'kilometers',
        })
      );
    }

    if (pointIndex < effectiveRoutePoints.length - 1) {
      const nextPoint = effectiveRoutePoints[pointIndex + 1];
      circles.push(
        circle(point([nextPoint.lon, nextPoint.lat]), maxDistanceKm, {
          steps: 64,
          units: 'kilometers',
        })
      );
    }

    return circles.length > 0
      ? ({
          type: 'FeatureCollection',
          features: circles,
        } as FeatureCollection)
      : null;
  }, [
    draggingPointId,
    effectiveRoutePoints,
    maxDistanceKm,
    routeDraggingPointId,
  ]);

  const onMapMouseDown = (event: any) => {
    const features = event.features;
    if (!isRouteLineInteraction(features)) {
      return;
    }

    event.preventDefault();
    const { lng, lat } = event.lngLat;
    const mapInstance = event.target;
    const clickPixel = mapInstance.project([lng, lat]);
    const pixelTolerance = 20;

    const tooCloseToExisting = routePoints.some(pointItem => {
      const pointPixel = mapInstance.project([pointItem.lon, pointItem.lat]);
      const distance = Math.sqrt(
        Math.pow(clickPixel.x - pointPixel.x, 2) +
          Math.pow(clickPixel.y - pointPixel.y, 2)
      );
      return distance < pixelTolerance;
    });

    if (!tooCloseToExisting) {
      setPendingRouteClick({ lng, lat });
    }
  };

  const onMapMouseMove = (event: any) => {
    const { lng, lat } = event.lngLat;

    if (pendingRouteClick && !routeDraggingPointId) {
      const newPointId = handleRouteMouseDown(
        pendingRouteClick.lng,
        pendingRouteClick.lat
      );
      if (newPointId) {
        setRouteDraggingPointId(newPointId);
        setLocalDragPosition({
          lat: pendingRouteClick.lat,
          lon: pendingRouteClick.lng,
        });
        setPendingRouteClick(null);
      }
      setHoverInfo(null);
      return;
    }

    if (routeDraggingPointId) {
      setLocalDragPosition({ lat, lon: lng });
      handleRouteDragMove(routeDraggingPointId, lng, lat);
      setHoverInfo(null);
      return;
    }

    const features = event.features;
    if (isRouteLineInteraction(features)) {
      const props: Record<string, any> = (features[0] as any).properties || {};
      const mapInstance = event.target as any;
      const pixel = mapInstance.project([lng, lat]);
      const surfaceKey = normalizeSurfaceKey(
        props.surface_norm || props.surface || 'unknown'
      );
      const surfaceLabel = t(`routeBuilder:surfaces.${surfaceKey}`, {
        defaultValue: surfaceKey,
      });
      const lenM = Number(props.length_m ?? 0);
      setHoverInfo({
        x: pixel.x,
        y: pixel.y,
        surface: surfaceLabel,
        lengthText: formatMeters(lenM),
      });
      return;
    }

    setHoverInfo(null);
  };

  const onMapMouseUp = (event: any) => {
    const { lng, lat } = event.lngLat;

    if (pendingRouteClick && !routeDraggingPointId) {
      handleRouteClick(pendingRouteClick.lng, pendingRouteClick.lat);
      setPendingRouteClick(null);
      return;
    }

    if (routeDraggingPointId) {
      handleRouteDragEnd(routeDraggingPointId, lng, lat);
      setRouteDraggingPointId(null);
      setLocalDragPosition(null);
    }

    setPendingRouteClick(null);
  };

  const onMapClick = (event: any) => {
    if (routeDraggingPointId) {
      return;
    }

    if (isRouteLineInteraction(event.features)) {
      return;
    }

    const target = event.originalEvent.target as HTMLElement;
    if (
      target &&
      (target.closest('.maplibregl-marker') ||
        target.classList.contains('maplibregl-marker'))
    ) {
      return;
    }

    const { lng, lat } = event.lngLat;
    addPoint(lng, lat);
  };

  const onMarkerClick = (pointId: string, event: any) => {
    event.originalEvent.stopPropagation();
    event.originalEvent.preventDefault();
    removePoint(pointId);
  };

  const onMarkerDragStart = (pointId: string) => {
    const pointItem = effectiveRoutePoints.find(point => point.id === pointId);
    if (!pointItem) {
      return;
    }

    setDraggingPointId(pointId);
    setLocalDragPosition({ lat: pointItem.lat, lon: pointItem.lon });
    handleMarkerDragStart(pointId);
  };

  const onMarkerDrag = (event: any) => {
    const { lng, lat } = event.lngLat;
    setLocalDragPosition({ lat, lon: lng });
  };

  const onMarkerDragEnd = (pointId: string, event: any) => {
    const { lng, lat } = event.lngLat;
    setDraggingPointId(null);
    setLocalDragPosition(null);
    updatePoint(pointId, lat, lng);
  };

  return {
    dragNeighborCircles,
    effectiveLoadingRouteData,
    effectiveRoutePoints,
    hoverInfo,
    maxDistanceCircle,
    onMapClick: !isLoading ? onMapClick : undefined,
    onMapMouseDown: !isLoading && routeData ? onMapMouseDown : undefined,
    onMapMouseMove,
    onMapMouseUp:
      routeDraggingPointId || pendingRouteClick ? onMapMouseUp : undefined,
    onMarkerClick,
    onMarkerDrag,
    onMarkerDragEnd,
    onMarkerDragStart,
  };
};
