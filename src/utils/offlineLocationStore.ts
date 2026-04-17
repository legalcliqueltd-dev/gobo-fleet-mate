/**
 * IndexedDB-based offline location store.
 *
 * More resilient than localStorage:
 * - Survives OS memory pressure better
 * - Handles large datasets (thousands of locations)
 * - Structured data with auto-incrementing keys
 *
 * Used by both Android and iOS fallback tracking paths.
 */

const DB_NAME = 'ftm_offline_locations';
const DB_VERSION = 2;
const STORE_NAME = 'locations';

export interface OfflineLocation {
  id?: number; // auto-increment key
  syncKey?: string;
  driverId: string;
  adminCode: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  batteryLevel: number;
  timestamp: string; // ISO string
  createdAt: number; // Date.now() for ordering
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('syncKey', 'syncKey', { unique: true });
      } else {
        const store = request.transaction?.objectStore(STORE_NAME);
        if (store && !store.indexNames.contains('syncKey')) {
          store.createIndex('syncKey', 'syncKey', { unique: true });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[OfflineLocationStore] Failed to open IndexedDB:', request.error);
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/** Store a location for later sync */
export async function addOfflineLocation(location: Omit<OfflineLocation, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      if (location.syncKey && store.indexNames.contains('syncKey')) {
        const index = store.index('syncKey');
        const existingReq = index.getKey(location.syncKey);

        existingReq.onsuccess = () => {
          if (existingReq.result !== undefined) {
            resolve();
            return;
          }
          store.add(location);
        };

        existingReq.onerror = () => reject(existingReq.error);
      } else {
        store.add(location);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        if (tx.error?.name === 'ConstraintError') {
          resolve();
          return;
        }
        reject(tx.error);
      };
    });
  } catch (error) {
    console.error('[OfflineLocationStore] addOfflineLocation error:', error);
  }
}

/** Get all pending locations, ordered by createdAt */
export async function getAllPendingLocations(): Promise<OfflineLocation[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).index('createdAt').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineLocationStore] getAllPendingLocations error:', error);
    return [];
  }
}

/** Get up to `limit` oldest pending locations */
export async function getPendingBatch(limit: number = 50): Promise<OfflineLocation[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('createdAt');
      const results: OfflineLocation[] = [];
      const cursorReq = index.openCursor();

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch (error) {
    console.error('[OfflineLocationStore] getPendingBatch error:', error);
    return [];
  }
}

/** Remove synced locations by their IDs */
export async function removeSyncedLocations(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('[OfflineLocationStore] removeSyncedLocations error:', error);
  }
}

/** Get the count of pending locations */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineLocationStore] getPendingCount error:', error);
    return 0;
  }
}

/** Clear all pending locations (e.g. user-initiated) */
export async function clearAllPendingLocations(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('[OfflineLocationStore] clearAllPendingLocations error:', error);
  }
}
