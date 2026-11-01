import {
  renderLocalRoadbook,
  generateRoadbookWithProgress,
} from '../services/localProjects';
import { offlineCache, type RoadbookIndexEntry } from './offlineCache';
import i18n from '../i18n';
import { normalizeLanguage } from '../i18n/languages';

export interface RoadbookCacheProgress {
  text: string;
  percent?: number;
}

interface CacheRoadbookForOfflineParams {
  routeId: string;
  routeName?: string;
  profile?: string;
  fallbackMessage?: string;
  onProgress?: (progress: RoadbookCacheProgress) => void;
}

export async function cacheRoadbookForOffline({
  routeId,
  routeName,
  profile,
  fallbackMessage = i18n.t('common.loading'),
  onProgress,
}: CacheRoadbookForOfflineParams): Promise<void> {
  const language = normalizeLanguage(i18n.resolvedLanguage);
  const emitProgress = (text: string, percent?: number) => {
    onProgress?.({ text, percent });
  };

  emitProgress(fallbackMessage, 0);

  await generateRoadbookWithProgress({
    routeId,
    profile,
    onEvent: evt => {
      const updateProgress = (text: string, percent?: number) => {
        emitProgress(text || fallbackMessage, percent);
      };

      if (evt.event === 'status') {
        const progress = evt.data.progress;
        const total = evt.data.total;
        const percent =
          typeof progress === 'number' && typeof total === 'number' && total > 0
            ? Math.round((progress / total) * 100)
            : undefined;

        updateProgress(evt.data.message || fallbackMessage, percent);
      }

      if (evt.event === 'progress') {
        const current = evt.data.current;
        const total = evt.data.total;
        const percent =
          typeof evt.data.percentage === 'number'
            ? evt.data.percentage
            : typeof current === 'number' &&
                typeof total === 'number' &&
                total > 0
              ? Math.round((current / total) * 100)
              : undefined;

        updateProgress(evt.data.message || fallbackMessage, percent);
      }
    },
  });

  emitProgress(fallbackMessage, 100);

  const pdfResponse = await renderLocalRoadbook('/roadbook', {
    method: 'POST',
    body: JSON.stringify({
      routeId,
      exportType: 'pdf-screen',
      language,
    }),
  });
  const pdfBlob = await pdfResponse.blob();
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

  const indexResponse = await renderLocalRoadbook('/roadbook', {
    method: 'POST',
    body: JSON.stringify({
      routeId,
      exportType: 'pdf-index',
    }),
  });
  const indexJson = await indexResponse.json();

  if (!Array.isArray(indexJson)) {
    throw new Error('pdf-index response is not an array');
  }

  await offlineCache.saveRoadbookPdfAndIndex(
    routeId,
    pdfBytes,
    indexJson as RoadbookIndexEntry[],
    routeName,
    profile,
    language
  );
}
