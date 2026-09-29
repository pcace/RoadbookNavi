import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Center, Spinner, Text } from '@chakra-ui/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './RoadbookPdfViewer.css';

import {
  renderLocalRoadbook,
  listLocalProjects,
  generateRoadbookWithProgress,
} from '../services/localProjects';
import { offlineCache } from '../utils/offlineCache';
import { useAppStore } from '../stores/appStore';
import { useSettings } from '../stores/settingsStore';

// Configure PDF.js worker – use explicit node_modules path so Vite bundles it correctly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type ExportType = 'pdf' | 'pdf-roll' | 'pdf-screen';

interface RoadbookPdfViewerProps {
  routeId: string;
  exportType?: ExportType;
}

interface Destination {
  pageIndex: number;
  leftOffset: number;
  bottomOffset: number;
  pageHeight?: number; // Height of the PDF page at scale 1
}

interface LazyPdfPageProps {
  pageNumber: number;
  width: number;
  height: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onRenderSuccess: () => void;
}

const LazyPdfPage: React.FC<LazyPdfPageProps> = ({
  pageNumber,
  width,
  height,
  scrollRoot,
  onRenderSuccess,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber === 1);

  useEffect(() => {
    if (shouldRender || !wrapperRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current, rootMargin: '150% 0px' }
    );
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [scrollRoot, shouldRender]);

  return (
    <div
      ref={wrapperRef}
      data-roadbook-page={pageNumber}
      style={{ width: '100%', height }}
    >
      {shouldRender && (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={onRenderSuccess}
          loading={<></>}
        />
      )}
    </div>
  );
};

export const RoadbookPdfViewer: React.FC<RoadbookPdfViewerProps> = ({
  routeId,
  exportType = 'pdf',
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageDimensions, setPageDimensions] = useState<
    Array<{ width: number; height: number }>
  >([]);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [markerCount, setMarkerCount] = useState<number>(0);
  const [renderedPageCount, setRenderedPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState<string>('');
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentEntryIndexRef = useRef(0);
  const desiredEntryIndexRef = useRef<number>(0);
  const latestJumpRequestIdRef = useRef(0);
  const entryDestinationsRef = useRef<Map<number, Destination>>(new Map());
  const lastAutoFollowTargetRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const scrollDirectionRef = useRef<-1 | 1>(1);
  const lastTsRef = useRef<number | null>(null);
  const currentVelocityRef = useRef(0);

  const { app: appSettings, interface: interfaceSettings } = useSettings();
  const pdfLanguage = interfaceSettings.language.startsWith('de') ? 'de' : 'en';
  const odometer = useAppStore(state => state.odometer);
  const autoFollow = useAppStore(state => state.autoFollow);
  const roadbookIndex = useAppStore(state => state.roadbookIndex);
  const setRoadbookIndex = useAppStore(state => state.setRoadbookIndex);
  const setCurrentRoadbookIndex = useAppStore(
    state => state.setCurrentRoadbookIndex
  );
  const setCurrentRouteName = useAppStore(state => state.setCurrentRouteName);
  const routeProfile = useAppStore(state => state.routeProfile);

  const stopContinuousScroll = useCallback(() => {
    isAutoScrollingRef.current = false;

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    lastTsRef.current = null;
    currentVelocityRef.current = 0;
  }, []);

  const handleNativeWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      let delta = event.deltaY;

      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        delta *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        delta *= container.clientHeight;
      }

      if (delta === 0) return;

      event.preventDefault();
      event.stopPropagation();
      stopContinuousScroll();
      container.scrollTop += delta;
    },
    [stopContinuousScroll]
  );

  const startContinuousScroll = useCallback(
    (direction: -1 | 1) => {
      const container = containerRef.current;
      if (!container) return;

      scrollDirectionRef.current = direction;

      if (isAutoScrollingRef.current) return;
      isAutoScrollingRef.current = true;

      const targetPxPerSecond = appSettings.roadbookScrollSpeed * 30;
      const accelerationTimeMs = 180;
      const maxDtMs = 32;

      const step = (ts: number) => {
        if (!isAutoScrollingRef.current) return;

        const container = containerRef.current;
        if (!container) {
          stopContinuousScroll();
          return;
        }

        const lastTs = lastTsRef.current;
        lastTsRef.current = ts;
        const dtMs =
          lastTs == null ? 0 : Math.min(maxDtMs, Math.max(0, ts - lastTs));
        const dt = dtMs / 1000;

        const directionNow = scrollDirectionRef.current;
        const targetVelocity = directionNow * targetPxPerSecond;

        const accelAlpha =
          dtMs <= 0 ? 1 : Math.min(1, dtMs / accelerationTimeMs);
        currentVelocityRef.current =
          currentVelocityRef.current +
          (targetVelocity - currentVelocityRef.current) * accelAlpha;

        if (dt > 0) {
          const prev = container.scrollTop;
          container.scrollTop = prev + currentVelocityRef.current * dt;

          const next = container.scrollTop;
          if (next === prev) {
            stopContinuousScroll();
            return;
          }
        }

        rafIdRef.current = requestAnimationFrame(step);
      };

      rafIdRef.current = requestAnimationFrame(step);
    },
    [appSettings.roadbookScrollSpeed, stopContinuousScroll]
  );

  const normalizeKeyName = useCallback((key: string) => {
    return key === ' ' ? 'Space' : key;
  }, []);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    );
  }, []);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  }, []);

  const getTotalEntriesForStepping = useCallback((): number => {
    let maxMarker = 0;
    for (const markerNumber of Array.from(
      entryDestinationsRef.current.keys()
    )) {
      if (markerNumber > maxMarker) maxMarker = markerNumber;
    }
    return maxMarker;
  }, []);

  const findUpcomingIndexByOdometer = useCallback(
    (distanceMeters: number): number | null => {
      if (roadbookIndex.length === 0) return null;

      const toleranceMeters = 1;
      let lo = 0;
      let hi = roadbookIndex.length - 1;
      let answer: number | null = null;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const midDist = roadbookIndex[mid]?.distance ?? 0;
        if (midDist > distanceMeters + toleranceMeters) {
          answer = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }

      return answer;
    },
    [roadbookIndex]
  );

  const performJumpToEntryIndex = useCallback(
    async (entryIndex: number, requestId: number): Promise<boolean> => {
      const container = containerRef.current;
      if (!container || !pageWidth) return false;

      const totalEntries = getTotalEntriesForStepping();
      if (totalEntries <= 0) {
        return false;
      }

      const clampedEntryIndex = clamp(entryIndex, 0, totalEntries - 1);
      const markerNumber = clampedEntryIndex + 1;
      const markerDestination = entryDestinationsRef.current.get(markerNumber);

      if (!markerDestination) {
        return false;
      }

      try {
        // Find the actual rendered page element in the DOM
        const pageNumber = markerDestination.pageIndex + 1;
        const pageElement = container.querySelector(
          `[data-roadbook-page="${pageNumber}"]`
        ) as HTMLElement | null;
        if (!pageElement) return false;
        // Calculate scroll position based on actual DOM element
        // Use getBoundingClientRect for accurate positioning relative to container
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageElement.getBoundingClientRect();

        // Position of the page relative to container's current scroll position
        const pageTopInContainer =
          pageRect.top - containerRect.top + container.scrollTop;

        // Calculate marker position within the page
        // bottomOffset is from bottom in PDF coordinates, needs to be converted
        const scale = containerWidth / pageWidth;
        const pdfPageHeight = markerDestination.pageHeight || pageWidth * 1.414;
        const markerYFromTop = pdfPageHeight - markerDestination.bottomOffset;
        const markerYFromTopScaled = markerYFromTop * scale;

        // Final scroll position
        const scrollTop = pageTopInContainer + markerYFromTopScaled;

        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        });

        // Only commit state if this is still the latest request
        if (requestId !== latestJumpRequestIdRef.current) return true;

        currentEntryIndexRef.current = clampedEntryIndex;
        desiredEntryIndexRef.current = clampedEntryIndex;
        setCurrentRoadbookIndex(clampedEntryIndex + 1);
        return true;
      } catch (e) {
        return false;
      }
    },
    [
      clamp,
      containerWidth,
      getTotalEntriesForStepping,
      pageWidth,
      setCurrentRoadbookIndex,
    ]
  );

  const requestJumpToEntryIndex = useCallback(
    (entryIndex: number): Promise<boolean> => {
      const totalEntries = getTotalEntriesForStepping();
      if (totalEntries <= 0) return Promise.resolve(false);

      const clamped = clamp(entryIndex, 0, totalEntries - 1);
      desiredEntryIndexRef.current = clamped;

      const requestId = ++latestJumpRequestIdRef.current;
      return performJumpToEntryIndex(clamped, requestId);
    },
    [clamp, getTotalEntriesForStepping, performJumpToEntryIndex]
  );

  const requestStepBy = useCallback(
    (direction: -1 | 1): Promise<boolean> => {
      const totalEntries = getTotalEntriesForStepping();
      if (totalEntries <= 0) return Promise.resolve(false);

      const base = clamp(
        desiredEntryIndexRef.current,
        0,
        Math.max(0, totalEntries - 1)
      );
      const next = clamp(base + direction, 0, totalEntries - 1);
      return requestJumpToEntryIndex(next);
    },
    [clamp, getTotalEntriesForStepping, requestJumpToEntryIndex]
  );

  const jumpToNextOrPrevEntry = useCallback(
    async (direction: -1 | 1) => {
      await requestStepBy(direction);
    },
    [requestStepBy]
  );

  // Auto-follow
  useEffect(() => {
    if (!autoFollow) {
      lastAutoFollowTargetRef.current = null;
      return;
    }
    if (roadbookIndex.length === 0) return;
    if (entryDestinationsRef.current.size === 0) return;

    const upcomingIndex = findUpcomingIndexByOdometer(odometer);
    if (upcomingIndex == null) return;

    if (lastAutoFollowTargetRef.current === upcomingIndex) return;

    void requestJumpToEntryIndex(upcomingIndex).then(jumped => {
      if (jumped) lastAutoFollowTargetRef.current = upcomingIndex;
    });
  }, [
    autoFollow,
    containerWidth,
    findUpcomingIndexByOdometer,
    markerCount,
    numPages,
    odometer,
    pageWidth,
    renderedPageCount,
    roadbookIndex.length,
    requestJumpToEntryIndex,
  ]);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w && Number.isFinite(w)) {
        setContainerWidth(w);
      }
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    const resolveRouteMetadata = async (): Promise<{
      routeName?: string;
      profile: string;
    }> => {
      let resolvedRouteName: string | undefined;
      let resolvedProfile = routeProfile;

      try {
        const cachedMetadata = await offlineCache.getRoadbookMetadata(routeId);
        if (cachedMetadata?.routeName) {
          resolvedRouteName = cachedMetadata.routeName;
        }
        if (cachedMetadata?.profile) {
          resolvedProfile = cachedMetadata.profile;
        }
      } catch (error) {
        console.warn(
          '[RoadbookPdfViewer] Failed to read cached metadata',
          error
        );
      }

      try {
        const routes = await listLocalProjects();
        if (Array.isArray(routes)) {
          const matchingRoute = routes.find(
            (entry: { id?: string; name?: string; profile?: string }) =>
              entry.id === routeId
          );

          if (matchingRoute?.name) resolvedRouteName = matchingRoute.name;
          if (matchingRoute?.profile) resolvedProfile = matchingRoute.profile;
        }
      } catch (error) {
        console.warn('[RoadbookPdfViewer] Failed to resolve metadata', error);
      }

      if (!cancelled && resolvedRouteName) {
        setCurrentRouteName(resolvedRouteName);
      }

      return {
        routeName: resolvedRouteName,
        profile: resolvedProfile,
      };
    };

    const loadFromCache = async (): Promise<boolean> => {
      if (!routeId) return false;

      const cachedPdf = await offlineCache.getRoadbookPdf(routeId, pdfLanguage);
      const cachedIndex = await offlineCache.getRoadbookIndex(routeId);

      if (!cachedPdf || !cachedIndex) return false;

      const arrayBuffer = new ArrayBuffer(cachedPdf.byteLength);
      new Uint8Array(arrayBuffer).set(cachedPdf);
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);

      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return false;
      }

      setPdfUrl(objectUrl);
      setPdfData(cachedPdf);
      setRoadbookIndex(cachedIndex);
      return true;
    };

    const load = async () => {
      setError(null);
      setPdfUrl(null);
      setPdfData(null);
      setNumPages(0);
      setPageDimensions([]);
      setRoadbookIndex([]);
      setCurrentRoadbookIndex(null);
      setLoadingText('');
      setLoadingPercent(null);

      const routeMetadataPromise = resolveRouteMetadata();

      const cachedOk = await loadFromCache();
      if (cachedOk) {
        await routeMetadataPromise;
        return;
      }

      try {
        const routeMetadata = await routeMetadataPromise;

        setLoadingText('Generiere Roadbook…');
        setLoadingPercent(0);
        await generateRoadbookWithProgress({
          routeId,
          profile: routeMetadata.profile,
          onEvent: evt => {
            if (evt.event === 'status') {
              const text = evt.data.message || 'Generiere Roadbook…';
              const progress = evt.data.progress;
              const total = evt.data.total;
              const percent =
                typeof progress === 'number' &&
                typeof total === 'number' &&
                total > 0
                  ? Math.round((progress / total) * 100)
                  : null;
              setLoadingText(text);
              setLoadingPercent(percent);
            }
            if (evt.event === 'progress') {
              const text = evt.data.message || 'Generiere Roadbook…';
              const percent =
                typeof evt.data.percentage === 'number'
                  ? evt.data.percentage
                  : typeof evt.data.current === 'number' &&
                      typeof evt.data.total === 'number' &&
                      evt.data.total > 0
                    ? Math.round((evt.data.current / evt.data.total) * 100)
                    : null;
              setLoadingText(text);
              setLoadingPercent(percent);
            }
          },
        });

        setLoadingText('Lade PDF…');
        setLoadingPercent(null);

        const response = await renderLocalRoadbook('/roadbook', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            routeId,
            exportType,
          }),
        });

        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        objectUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPdfUrl(objectUrl);
        setPdfData(bytes);

        setLoadingText('Lade Index…');
        setLoadingPercent(null);

        const indexResponse = await renderLocalRoadbook('/roadbook', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            routeId,
            exportType: 'pdf-index',
          }),
        });

        const indexJson = await indexResponse.json();
        if (!cancelled && Array.isArray(indexJson)) {
          setRoadbookIndex(indexJson);
          try {
            await offlineCache.saveRoadbookPdfAndIndex(
              routeId,
              bytes,
              indexJson,
              routeMetadata.routeName,
              routeMetadata.profile,
              pdfLanguage
            );
          } catch (e) {
            console.warn('[RoadbookPdfViewer] Failed to cache PDF/index', e);
          }
        }
      } catch (e) {
        const ok = await loadFromCache();
        if (!ok) throw e;
      }
    };

    load().catch((e: unknown) => {
      if (cancelled) return;
      if (e instanceof DOMException && e.name === 'AbortError') return;

      const message =
        e instanceof Error ? e.message : 'Failed to load roadbook PDF';
      setError(message);
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    exportType,
    pdfLanguage,
    routeId,
    routeProfile,
    setCurrentRoadbookIndex,
    setRoadbookIndex,
  ]);

  // Reset entry cursor when loading a new PDF
  useEffect(() => {
    currentEntryIndexRef.current = 0;
    desiredEntryIndexRef.current = 0;
    latestJumpRequestIdRef.current = 0;
    lastAutoFollowTargetRef.current = null;
    setRenderedPageCount(0);
    setCurrentRoadbookIndex(null);
  }, [pdfUrl, setCurrentRoadbookIndex]);

  // Build marker index
  useEffect(() => {
    entryDestinationsRef.current = new Map();
    setMarkerCount(0);
    if (!pdfData) return;

    let cancelled = false;

    const run = async () => {
      try {
        // PDF.js transfers typed arrays to its worker. Keep the state-owned
        // bytes intact because react-pdf uses them independently below.
        const loadingTask = pdfjs.getDocument({ data: pdfData.slice() });
        const doc = await loadingTask.promise;
        const map = new Map<number, Destination>();
        const numPages: number = doc.numPages || 0;

        // Get first page dimensions
        if (numPages > 0) {
          const firstPage = await doc.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1 });
          setPageWidth(viewport.width);
        }

        const samples: Array<{
          n: number;
          pageIndex: number;
          y: number;
          raw: string;
        }> = [];

        for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
          if (cancelled) return;

          const page = await doc.getPage(pageNumber);
          const pageIndex = pageNumber - 1;
          const viewport = page.getViewport({ scale: 1 });
          const pageHeight = viewport.height;

          const textContent = await page.getTextContent();
          const items = (textContent.items || []) as any[];

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const raw = typeof item?.str === 'string' ? item.str : '';
            const str = raw.trim();

            let markerNumber: number | null = null;

            const direct = str.match(/^#\s*(\d+)$/);
            if (direct) {
              markerNumber = Number(direct[1]);
            } else if (str === '#') {
              const nextRaw =
                typeof items[i + 1]?.str === 'string' ? items[i + 1].str : '';
              const nextStr = nextRaw.trim();
              const digits = nextStr.match(/^(\d+)$/);
              if (digits) markerNumber = Number(digits[1]);
            } else {
              const embedded = str.match(/#\s*(\d{1,6})/);
              if (embedded) markerNumber = Number(embedded[1]);
            }

            if (
              !markerNumber ||
              !Number.isInteger(markerNumber) ||
              markerNumber <= 0
            )
              continue;
            if (map.has(markerNumber)) continue;

            const yFromBottom = item?.transform?.[5];
            if (
              typeof yFromBottom !== 'number' ||
              !Number.isFinite(yFromBottom)
            ) {
              continue;
            }

            map.set(markerNumber, {
              pageIndex,
              leftOffset: 0,
              bottomOffset: yFromBottom,
              pageHeight,
            });

            if (samples.length < 30) {
              samples.push({ n: markerNumber, pageIndex, y: yFromBottom, raw });
            }
          }
        }

        try {
          if (typeof doc.destroy === 'function') {
            await doc.destroy();
          }
        } catch {
          // ignore
        }

        if (cancelled) return;
        entryDestinationsRef.current = map;
        setMarkerCount(map.size);
      } catch (e) {
        console.error('[RoadbookPdfViewer] marker index: failed', e);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pdfData]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const keyName = normalizeKeyName(e.key);
      const isScrollUp = keyName === appSettings.roadbookScrollUpKey;
      const isScrollDown = keyName === appSettings.roadbookScrollDownKey;

      if (!isScrollUp && !isScrollDown) return;

      e.preventDefault();
      e.stopPropagation();

      const direction: -1 | 1 = isScrollUp ? -1 : 1;

      if (appSettings.roadbookScrollMode === 'continuous') {
        startContinuousScroll(direction);
        return;
      }

      if (e.repeat) return;
      jumpToNextOrPrevEntry(direction).catch(() => {
        // Ignore navigation errors
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyName = normalizeKeyName(e.key);
      if (
        appSettings.roadbookScrollMode === 'continuous' &&
        (keyName === appSettings.roadbookScrollUpKey ||
          keyName === appSettings.roadbookScrollDownKey)
      ) {
        e.preventDefault();
        e.stopPropagation();
        stopContinuousScroll();
      }
    };

    const handleGlobalStop = () => {
      stopContinuousScroll();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleGlobalStop);
    document.addEventListener('visibilitychange', handleGlobalStop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleGlobalStop);
      document.removeEventListener('visibilitychange', handleGlobalStop);
      stopContinuousScroll();
    };
  }, [
    appSettings.roadbookScrollDownKey,
    appSettings.roadbookScrollMode,
    appSettings.roadbookScrollUpKey,
    getTotalEntriesForStepping,
    isEditableTarget,
    jumpToNextOrPrevEntry,
    normalizeKeyName,
    startContinuousScroll,
    stopContinuousScroll,
  ]);

  if (error) {
    return (
      <Center h="full" w="full">
        <Box textAlign="center" maxW="500px" px={4}>
          <Text fontWeight="semibold" mb={2}>
            PDF konnte nicht geladen werden
          </Text>
          <Text color="gray.600" fontSize="sm">
            {error}
          </Text>
        </Box>
      </Center>
    );
  }

  if (!pdfUrl) {
    return (
      <Box
        ref={containerRef}
        className="roadbookPdfViewer"
        h="100%"
        w="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box textAlign="center" px={4}>
          <Spinner size="lg" mb={3} />
          <Text fontWeight="semibold">{loadingText || 'Lade Roadbook…'}</Text>
          {loadingPercent != null && (
            <Text color="gray.600" fontSize="sm">
              {loadingPercent}%
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      className="roadbookPdfViewer"
      h="full"
      w="full"
      overflow="auto"
      onWheel={handleNativeWheel}
    >
      {!containerWidth ? (
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Box textAlign="center" px={4}>
            <Spinner size="lg" mb={3} />
            <Text fontWeight="semibold">Lade Roadbook…</Text>
          </Box>
        </Box>
      ) : (
        <Document
          file={pdfUrl}
          onLoadSuccess={async pdf => {
            const dimensions = await Promise.all(
              Array.from({ length: pdf.numPages }, async (_, index) => {
                const page = await pdf.getPage(index + 1);
                const viewport = page.getViewport({ scale: 1 });
                return { width: viewport.width, height: viewport.height };
              })
            );
            setPageDimensions(dimensions);
            if (dimensions[0]?.width) setPageWidth(dimensions[0].width);
            setNumPages(pdf.numPages);
          }}
          onLoadError={pdfError => {
            console.error('[RoadbookPdfViewer] PDF load failed', pdfError);
            setError(
              pdfError instanceof Error
                ? pdfError.message
                : 'Die erzeugte PDF-Datei ist ungültig.'
            );
          }}
          onSourceError={pdfError => {
            console.error('[RoadbookPdfViewer] PDF source failed', pdfError);
            setError(
              pdfError instanceof Error
                ? pdfError.message
                : 'Die PDF-Daten konnten nicht gelesen werden.'
            );
          }}
          loading={
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Box textAlign="center" px={4}>
                <Spinner size="lg" mb={3} />
                <Text fontWeight="semibold">Lade Roadbook…</Text>
              </Box>
            </Box>
          }
          error={
            <Center h="full" w="full">
              <Box textAlign="center" maxW="500px" px={4}>
                <Text fontWeight="semibold" mb={2}>
                  PDF konnte nicht geladen werden
                </Text>
              </Box>
            </Center>
          }
        >
          {Array.from(new Array(numPages), (_, index) => {
            const dimensions = pageDimensions[index] ?? {
              width: pageWidth || containerWidth,
              height: (pageWidth || containerWidth) * 1.414,
            };
            return (
              <LazyPdfPage
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                scrollRoot={containerRef}
                width={containerWidth}
                height={containerWidth * (dimensions.height / dimensions.width)}
                onRenderSuccess={() => setRenderedPageCount(count => count + 1)}
              />
            );
          })}
        </Document>
      )}
    </Box>
  );
};
