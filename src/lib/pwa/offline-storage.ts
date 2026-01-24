/**
 * Offline Storage for Route and Job Data
 *
 * Caches route data in IndexedDB for offline access.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'dgs-field-data';
const DB_VERSION = 1;
const ROUTE_STORE = 'routes';
const JOBS_STORE = 'jobs';
const SHIFTS_STORE = 'shifts';

let dbInstance: IDBPDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Routes store
      if (!db.objectStoreNames.contains(ROUTE_STORE)) {
        const store = db.createObjectStore(ROUTE_STORE, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      // Jobs store
      if (!db.objectStoreNames.contains(JOBS_STORE)) {
        const store = db.createObjectStore(JOBS_STORE, { keyPath: 'id' });
        store.createIndex('routeId', 'routeId', { unique: false });
        store.createIndex('date', 'scheduledDate', { unique: false });
      }

      // Shifts store
      if (!db.objectStoreNames.contains(SHIFTS_STORE)) {
        const store = db.createObjectStore(SHIFTS_STORE, { keyPath: 'id' });
        store.createIndex('date', 'shiftDate', { unique: false });
      }
    },
  });

  return dbInstance;
}

// =============================================================================
// Route Storage
// =============================================================================

export interface CachedRoute {
  id: string;
  date: string;
  name: string | null;
  status: string;
  stops: CachedStop[];
  cachedAt: number;
}

export interface CachedStop {
  id: string;
  order: number;
  jobId: string;
  estimatedArrival: string | null;
  client: {
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  location: {
    addressLine1: string;
    city: string;
    zipCode: string;
    lat: number | null;
    lng: number | null;
    gateCode: string | null;
    accessNotes: string | null;
  };
  dogs: Array<{
    name: string;
    breed: string | null;
    isSafe: boolean;
    safetyNotes: string | null;
  }>;
  jobStatus: string;
  notes: string | null;
}

/**
 * Cache today's route
 */
export async function cacheRoute(route: CachedRoute): Promise<void> {
  const db = await getDB();
  const cachedRoute = { ...route, cachedAt: Date.now() };
  await db.put(ROUTE_STORE, cachedRoute);
  console.log('[OfflineStorage] Route cached:', route.id);
}

/**
 * Get cached route by date
 */
export async function getCachedRouteByDate(date: string): Promise<CachedRoute | undefined> {
  const db = await getDB();
  const routes = await db.getAllFromIndex(ROUTE_STORE, 'date', date);
  return routes[0];
}

/**
 * Get cached route by ID
 */
export async function getCachedRoute(id: string): Promise<CachedRoute | undefined> {
  const db = await getDB();
  return db.get(ROUTE_STORE, id);
}

/**
 * Check if cached route is stale (older than 5 minutes)
 */
export function isRouteStale(route: CachedRoute): boolean {
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - route.cachedAt > fiveMinutes;
}

/**
 * Clear old routes (older than 7 days)
 */
export async function clearOldRoutes(): Promise<void> {
  const db = await getDB();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const tx = db.transaction(ROUTE_STORE, 'readwrite');
  const store = tx.objectStore(ROUTE_STORE);
  let cursor = await store.openCursor();

  while (cursor) {
    if (cursor.value.cachedAt < sevenDaysAgo) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
}

// =============================================================================
// Job Storage
// =============================================================================

export interface CachedJob {
  id: string;
  routeId: string | null;
  scheduledDate: string;
  status: string;
  clientId: string;
  locationId: string;
  notes: string | null;
  photos: string[];
  cachedAt: number;
}

/**
 * Cache a job update (for offline status changes)
 */
export async function cacheJob(job: CachedJob): Promise<void> {
  const db = await getDB();
  const cachedJob = { ...job, cachedAt: Date.now() };
  await db.put(JOBS_STORE, cachedJob);
}

/**
 * Get pending job updates (jobs modified while offline)
 */
export async function getPendingJobUpdates(): Promise<CachedJob[]> {
  const db = await getDB();
  return db.getAll(JOBS_STORE);
}

/**
 * Remove a job from cache after syncing
 */
export async function removeCachedJob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(JOBS_STORE, id);
}

// =============================================================================
// Shift Storage
// =============================================================================

export interface CachedShift {
  id: string;
  shiftDate: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
  vehicleType: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  breaks: Array<{
    start: string;
    end: string | null;
    type: string;
  }>;
  cachedAt: number;
}

/**
 * Cache current shift
 */
export async function cacheShift(shift: CachedShift): Promise<void> {
  const db = await getDB();
  const cachedShift = { ...shift, cachedAt: Date.now() };
  await db.put(SHIFTS_STORE, cachedShift);
  console.log('[OfflineStorage] Shift cached:', shift.id);
}

/**
 * Get cached shift for today
 */
export async function getCachedShiftByDate(date: string): Promise<CachedShift | undefined> {
  const db = await getDB();
  const shifts = await db.getAllFromIndex(SHIFTS_STORE, 'date', date);
  return shifts[0];
}

// =============================================================================
// Sync Status
// =============================================================================

export interface SyncStatus {
  lastSync: number | null;
  pendingJobUpdates: number;
  pendingPhotos: number;
  isOnline: boolean;
}

/**
 * Get the current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const pendingJobs = await getPendingJobUpdates();

  return {
    lastSync: localStorage.getItem('lastSync')
      ? parseInt(localStorage.getItem('lastSync')!, 10)
      : null,
    pendingJobUpdates: pendingJobs.length,
    pendingPhotos: 0, // Will be updated by photo queue
    isOnline: navigator.onLine,
  };
}

/**
 * Update last sync timestamp
 */
export function updateLastSync(): void {
  localStorage.setItem('lastSync', Date.now().toString());
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clear all cached data
 */
export async function clearAllCachedData(): Promise<void> {
  const db = await getDB();
  await db.clear(ROUTE_STORE);
  await db.clear(JOBS_STORE);
  await db.clear(SHIFTS_STORE);
  localStorage.removeItem('lastSync');
  console.log('[OfflineStorage] All cached data cleared');
}
