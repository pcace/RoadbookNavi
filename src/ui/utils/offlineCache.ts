export type RoadbookIndexEntry = {
  index: number;
  distance: number;
  lat: number;
  lng: number;
};

interface CachedRoadbookPdf {
  routeId: string;
  pdfBytes: Uint8Array;
  cachedAt: number;
  language?: string;
  routeName?: string;
  profile?: string;
}

interface CachedRoadbookIndex {
  routeId: string;
  index: RoadbookIndexEntry[];
  entryCount: number;
  cachedAt: number;
  routeName?: string;
  profile?: string;
}

interface RoadbookMetadata {
  routeId: string;
  routeName?: string;
  profile?: string;
  entryCount: number;
  cachedAt: number;
}

export class SimpleOfflineCache {
  constructor(private dbName = 'RoadbookCache') {}
  private version = 6; // v6 removes the retired settings cache.
  private roadbooksMetadataStoreName = 'roadbooks_metadata';
  private roadbooksPdfStoreName = 'roadbooks_pdf';
  private roadbooksIndexStoreName = 'roadbooks_index';
  private db: IDBDatabase | null = null;

  private async clearStores(storeNames: string[]): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(storeNames, 'readwrite');

    return new Promise((resolve, reject) => {
      let completedRequests = 0;

      const onComplete = () => {
        completedRequests++;
        if (completedRequests === storeNames.length) {
          resolve();
        }
      };

      storeNames.forEach(storeName => {
        const request = transaction.objectStore(storeName).clear();

        request.onsuccess = onComplete;
        request.onerror = () => {
          reject(new Error(`Failed to clear cache store: ${storeName}`));
        };
      });
    });
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Drop legacy store (old parsed roadbook entries)
        if (db.objectStoreNames.contains('roadbooks')) {
          db.deleteObjectStore('roadbooks');
        }

        // Create roadbooks metadata object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.roadbooksMetadataStoreName)) {
          const metadataStore = db.createObjectStore(
            this.roadbooksMetadataStoreName,
            { keyPath: 'routeId' }
          );
          metadataStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Store PDF bytes for offline roadbook viewing
        if (!db.objectStoreNames.contains(this.roadbooksPdfStoreName)) {
          const pdfStore = db.createObjectStore(this.roadbooksPdfStoreName, {
            keyPath: 'routeId',
          });
          pdfStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Store lightweight PDF index (distance + lat/lng + marker index)
        if (!db.objectStoreNames.contains(this.roadbooksIndexStoreName)) {
          const indexStore = db.createObjectStore(
            this.roadbooksIndexStoreName,
            { keyPath: 'routeId' }
          );
          indexStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Remove the obsolete settings store from older installations.
        if (db.objectStoreNames.contains('settings')) {
          db.deleteObjectStore('settings');
        }
      };
    });
  }

  async saveRoadbookPdfAndIndex(
    routeId: string,
    pdfBytes: Uint8Array,
    index: RoadbookIndexEntry[],
    routeName?: string,
    profile?: string,
    language?: string
  ): Promise<void> {
    try {
      const db = await this.openDB();
      const cachedAt = Date.now();
      const transaction = db.transaction(
        [
          this.roadbooksPdfStoreName,
          this.roadbooksIndexStoreName,
          this.roadbooksMetadataStoreName,
        ],
        'readwrite'
      );

      const pdfStore = transaction.objectStore(this.roadbooksPdfStoreName);
      const indexStore = transaction.objectStore(this.roadbooksIndexStoreName);
      const metadataStore = transaction.objectStore(
        this.roadbooksMetadataStoreName
      );

      const pdfRecord: CachedRoadbookPdf = {
        routeId,
        pdfBytes,
        cachedAt,
        routeName,
        profile,
        language,
      };

      const indexRecord: CachedRoadbookIndex = {
        routeId,
        index,
        entryCount: index.length,
        cachedAt,
        routeName,
        profile,
      };

      const metadata: RoadbookMetadata = {
        routeId,
        routeName,
        profile,
        entryCount: index.length,
        cachedAt,
      };

      return new Promise((resolve, reject) => {
        const pdfRequest = pdfStore.put(pdfRecord);
        const indexRequest = indexStore.put(indexRecord);
        const metadataRequest = metadataStore.put(metadata);

        let completed = 0;
        const onComplete = () => {
          completed++;
          if (completed === 3) {
            resolve();
          }
        };

        pdfRequest.onsuccess = onComplete;
        indexRequest.onsuccess = onComplete;
        metadataRequest.onsuccess = onComplete;

        pdfRequest.onerror = () =>
          reject(new Error(`Failed to cache PDF for route: ${routeId}`));
        indexRequest.onerror = () =>
          reject(new Error(`Failed to cache index for route: ${routeId}`));
        metadataRequest.onerror = () =>
          reject(new Error(`Failed to cache metadata for route: ${routeId}`));
      });
    } catch (error) {
      console.error('Error saving PDF roadbook to cache:', error);
      throw error;
    }
  }

  async getRoadbookPdf(
    routeId: string,
    language?: string
  ): Promise<Uint8Array | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(
        [this.roadbooksPdfStoreName],
        'readonly'
      );
      const store = transaction.objectStore(this.roadbooksPdfStoreName);

      return new Promise((resolve, reject) => {
        const request = store.get(routeId);

        request.onsuccess = () => {
          const result = request.result as CachedRoadbookPdf | undefined;
          resolve(
            result && (!language || result.language === language)
              ? result.pdfBytes
              : null
          );
        };

        request.onerror = () =>
          reject(new Error(`Failed to get cached PDF for route: ${routeId}`));
      });
    } catch (error) {
      console.error('Error getting PDF from cache:', error);
      return null;
    }
  }

  async getRoadbookIndex(
    routeId: string
  ): Promise<RoadbookIndexEntry[] | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(
        [this.roadbooksIndexStoreName],
        'readonly'
      );
      const store = transaction.objectStore(this.roadbooksIndexStoreName);

      return new Promise((resolve, reject) => {
        const request = store.get(routeId);

        request.onsuccess = () => {
          const result = request.result as CachedRoadbookIndex | undefined;
          resolve(result?.index ?? null);
        };

        request.onerror = () =>
          reject(new Error(`Failed to get cached index for route: ${routeId}`));
      });
    } catch (error) {
      console.error('Error getting index from cache:', error);
      return null;
    }
  }

  async hasRoadbookPdfAndIndex(routeId: string): Promise<boolean> {
    const [pdf, index] = await Promise.all([
      this.getRoadbookPdf(routeId),
      this.getRoadbookIndex(routeId),
    ]);
    return !!pdf && Array.isArray(index);
  }

  async deleteRoadbook(routeId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(
        [
          this.roadbooksMetadataStoreName,
          this.roadbooksPdfStoreName,
          this.roadbooksIndexStoreName,
        ],
        'readwrite'
      );
      const metadataStore = transaction.objectStore(
        this.roadbooksMetadataStoreName
      );
      const pdfStore = transaction.objectStore(this.roadbooksPdfStoreName);
      const indexStore = transaction.objectStore(this.roadbooksIndexStoreName);

      return new Promise((resolve, reject) => {
        const metadataRequest = metadataStore.delete(routeId);
        const pdfRequest = pdfStore.delete(routeId);
        const indexRequest = indexStore.delete(routeId);

        let completedRequests = 0;
        const onComplete = () => {
          completedRequests++;
          if (completedRequests === 3) {
            resolve();
          }
        };

        metadataRequest.onsuccess = onComplete;
        pdfRequest.onsuccess = onComplete;
        indexRequest.onsuccess = onComplete;

        metadataRequest.onerror = () => {
          reject(
            new Error(`Failed to delete cached metadata for route: ${routeId}`)
          );
        };

        pdfRequest.onerror = () => {
          reject(
            new Error(`Failed to delete cached PDF for route: ${routeId}`)
          );
        };

        indexRequest.onerror = () => {
          reject(
            new Error(`Failed to delete cached index for route: ${routeId}`)
          );
        };
      });
    } catch (error) {
      console.error('Error deleting roadbook from cache:', error);
      throw error;
    }
  }

  async getAllCachedRouteIds(): Promise<string[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(
        [this.roadbooksPdfStoreName, this.roadbooksIndexStoreName],
        'readonly'
      );
      const pdfStore = transaction.objectStore(this.roadbooksPdfStoreName);
      const indexStore = transaction.objectStore(this.roadbooksIndexStoreName);

      return new Promise((resolve, reject) => {
        const pdfRequest = pdfStore.getAllKeys();
        const indexRequest = indexStore.getAllKeys();

        let pdfKeys: string[] = [];
        let indexKeys: string[] = [];
        let done = 0;

        const finish = () => {
          done++;
          if (done !== 2) return;
          resolve(Array.from(new Set([...pdfKeys, ...indexKeys])));
        };

        pdfRequest.onsuccess = () => {
          pdfKeys = pdfRequest.result as string[];
          finish();
        };
        indexRequest.onsuccess = () => {
          indexKeys = indexRequest.result as string[];
          finish();
        };

        pdfRequest.onerror = () =>
          reject(new Error('Failed to get cached route IDs (pdf)'));
        indexRequest.onerror = () =>
          reject(new Error('Failed to get cached route IDs (index)'));
      });
    } catch (error) {
      console.error('Error getting all cached route IDs:', error);
      return [];
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      await this.clearStores([
        this.roadbooksMetadataStoreName,
        this.roadbooksPdfStoreName,
        this.roadbooksIndexStoreName,
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  async clearRoadbookCache(): Promise<void> {
    try {
      await this.clearStores([
        this.roadbooksMetadataStoreName,
        this.roadbooksPdfStoreName,
        this.roadbooksIndexStoreName,
      ]);
    } catch (error) {
      console.error('Error clearing cached roadbooks:', error);
      throw error;
    }
  }

  async getRoadbookMetadata(routeId: string): Promise<{
    routeId: string;
    routeName?: string;
    profile?: string;
    cachedAt: number;
    entryCount: number;
  } | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(
        [this.roadbooksMetadataStoreName],
        'readonly'
      );
      const store = transaction.objectStore(this.roadbooksMetadataStoreName);

      return new Promise((resolve, reject) => {
        const request = store.get(routeId);

        request.onsuccess = () => {
          const result = request.result as RoadbookMetadata | undefined;
          if (result) {
            resolve({
              routeId: result.routeId,
              routeName: result.routeName,
              profile: result.profile,
              cachedAt: result.cachedAt,
              entryCount: result.entryCount,
            });
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          reject(new Error(`Failed to get metadata for route: ${routeId}`));
        };
      });
    } catch (error) {
      console.error('Error getting roadbook metadata:', error);
      return null;
    }
  }
}

// Shared cache instance
export const offlineCache = new SimpleOfflineCache();
