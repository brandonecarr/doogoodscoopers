/**
 * Service Worker for DooGoodScoopers Field Portal
 *
 * Provides offline support, photo upload queue, and caching.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `dgs-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dgs-dynamic-${CACHE_VERSION}`;
const PHOTO_QUEUE_STORE = 'photo-upload-queue';

// Assets to precache
const PRECACHE_ASSETS = [
  '/app/field',
  '/app/field/route',
  '/app/field/shift',
  '/app/field/history',
];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (except for special handling)
  if (request.method !== 'GET') {
    // Handle photo uploads with background sync
    if (request.method === 'POST' && url.pathname.includes('/photos')) {
      event.respondWith(handlePhotoUpload(request));
      return;
    }
    return;
  }

  // API routes - Network first, fall back to cache
  if (url.pathname.startsWith('/api/field/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (images, fonts, etc.) - Cache first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/images/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App pages - Network first with offline fallback
  if (url.pathname.startsWith('/app/field')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - network only
  event.respondWith(fetch(request));
});

/**
 * Network First strategy
 * Try network, fall back to cache, then offline page
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/app/field');
      if (offlinePage) {
        return offlinePage;
      }
    }

    // Return error response
    return new Response('Offline - content not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Cache First strategy
 * Try cache, fall back to network
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Cache miss and network failed:', request.url);
    return new Response('', { status: 404 });
  }
}

/**
 * Handle photo uploads with queue for offline support
 */
async function handlePhotoUpload(request) {
  try {
    // Try to upload immediately
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    console.log('[SW] Photo upload failed, queuing for later');

    // Queue the upload for later using Background Sync if available
    if ('sync' in self.registration) {
      // Store request data for later
      const formData = await request.formData();
      await storePhotoForLater(request.url, formData);

      // Register for background sync
      await self.registration.sync.register('photo-upload');

      return new Response(JSON.stringify({
        success: true,
        queued: true,
        message: 'Photo queued for upload when online'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If no Background Sync, return error
    return new Response(JSON.stringify({
      success: false,
      error: 'Offline - upload failed'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Store photo data in IndexedDB for later upload
 */
async function storePhotoForLater(url, formData) {
  // Open IndexedDB
  const db = await openDB();

  // Convert FormData to storable format
  const photoData = {
    id: Date.now().toString(),
    url,
    timestamp: Date.now(),
    data: {}
  };

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      // Convert file to base64
      const buffer = await value.arrayBuffer();
      photoData.data[key] = {
        type: 'file',
        name: value.name,
        mimeType: value.type,
        data: arrayBufferToBase64(buffer)
      };
    } else {
      photoData.data[key] = { type: 'text', value };
    }
  }

  // Store in IndexedDB
  const tx = db.transaction(PHOTO_QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(PHOTO_QUEUE_STORE);
  await store.add(photoData);
}

/**
 * Background Sync event - process queued uploads
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'photo-upload') {
    console.log('[SW] Processing photo upload queue');
    event.waitUntil(processPhotoQueue());
  }
});

/**
 * Process all queued photo uploads
 */
async function processPhotoQueue() {
  const db = await openDB();
  const tx = db.transaction(PHOTO_QUEUE_STORE, 'readonly');
  const store = tx.objectStore(PHOTO_QUEUE_STORE);
  const photos = await getAllFromStore(store);

  for (const photo of photos) {
    try {
      // Reconstruct FormData
      const formData = new FormData();
      for (const [key, item] of Object.entries(photo.data)) {
        if (item.type === 'file') {
          const buffer = base64ToArrayBuffer(item.data);
          const blob = new Blob([buffer], { type: item.mimeType });
          formData.append(key, blob, item.name);
        } else {
          formData.append(key, item.value);
        }
      }

      // Attempt upload
      const response = await fetch(photo.url, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Remove from queue on success
        const deleteTx = db.transaction(PHOTO_QUEUE_STORE, 'readwrite');
        const deleteStore = deleteTx.objectStore(PHOTO_QUEUE_STORE);
        await deleteStore.delete(photo.id);
        console.log('[SW] Photo uploaded successfully:', photo.id);

        // Notify clients
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PHOTO_UPLOADED',
              id: photo.id
            });
          });
        });
      }
    } catch (error) {
      console.log('[SW] Photo upload still failing:', photo.id);
    }
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dgs-field-pwa', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHOTO_QUEUE_STORE)) {
        db.createObjectStore(PHOTO_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_QUEUE_COUNT') {
    getQueueCount().then((count) => {
      event.ports[0].postMessage({ count });
    });
  }
});

async function getQueueCount() {
  try {
    const db = await openDB();
    const tx = db.transaction(PHOTO_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(PHOTO_QUEUE_STORE);
    return new Promise((resolve) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

console.log('[SW] Service worker loaded');
