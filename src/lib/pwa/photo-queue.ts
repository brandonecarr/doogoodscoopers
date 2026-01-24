/**
 * Photo Queue for Offline Photo Capture
 *
 * Uses IndexedDB to store photos when offline and syncs when online.
 * Works alongside the service worker for background sync.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'dgs-field-photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export interface QueuedPhoto {
  id: string;
  jobId: string;
  type: 'before' | 'after' | 'issue';
  blob: Blob;
  mimeType: string;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'uploading' | 'failed';
}

export interface PhotoQueueStats {
  pending: number;
  uploading: number;
  failed: number;
  total: number;
}

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    },
  });

  return dbInstance;
}

/**
 * Add a photo to the queue
 */
export async function queuePhoto(
  jobId: string,
  blob: Blob,
  type: 'before' | 'after' | 'issue'
): Promise<string> {
  const db = await getDB();

  const photo: QueuedPhoto = {
    id: `${jobId}-${type}-${Date.now()}`,
    jobId,
    type,
    blob,
    mimeType: blob.type,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  await db.add(STORE_NAME, photo);
  console.log('[PhotoQueue] Photo queued:', photo.id);

  // Try to process immediately if online
  if (navigator.onLine) {
    processQueue();
  }

  return photo.id;
}

/**
 * Get all queued photos for a job
 */
export async function getPhotosForJob(jobId: string): Promise<QueuedPhoto[]> {
  const db = await getDB();
  const photos = await db.getAllFromIndex(STORE_NAME, 'jobId', jobId);
  return photos;
}

/**
 * Get all pending photos
 */
export async function getPendingPhotos(): Promise<QueuedPhoto[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter((p) => p.status === 'pending' || p.status === 'failed');
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<PhotoQueueStats> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);

  return {
    pending: all.filter((p) => p.status === 'pending').length,
    uploading: all.filter((p) => p.status === 'uploading').length,
    failed: all.filter((p) => p.status === 'failed').length,
    total: all.length,
  };
}

/**
 * Update photo status
 */
async function updatePhotoStatus(
  id: string,
  status: QueuedPhoto['status'],
  incrementRetry = false
): Promise<void> {
  const db = await getDB();
  const photo = await db.get(STORE_NAME, id);

  if (photo) {
    photo.status = status;
    if (incrementRetry) {
      photo.retryCount++;
    }
    await db.put(STORE_NAME, photo);
  }
}

/**
 * Remove a photo from the queue
 */
export async function removePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
  console.log('[PhotoQueue] Photo removed:', id);
}

/**
 * Process the upload queue
 */
export async function processQueue(): Promise<void> {
  if (!navigator.onLine) {
    console.log('[PhotoQueue] Offline, skipping queue processing');
    return;
  }

  const photos = await getPendingPhotos();
  console.log(`[PhotoQueue] Processing ${photos.length} photos`);

  for (const photo of photos) {
    // Skip if too many retries
    if (photo.retryCount >= 3) {
      await updatePhotoStatus(photo.id, 'failed');
      continue;
    }

    try {
      await updatePhotoStatus(photo.id, 'uploading');
      await uploadPhoto(photo);
      await removePhoto(photo.id);

      // Notify success
      window.dispatchEvent(
        new CustomEvent('photo-upload-success', {
          detail: { id: photo.id, jobId: photo.jobId },
        })
      );
    } catch (error) {
      console.error('[PhotoQueue] Upload failed:', photo.id, error);
      await updatePhotoStatus(photo.id, 'pending', true);

      // Notify failure
      window.dispatchEvent(
        new CustomEvent('photo-upload-error', {
          detail: { id: photo.id, jobId: photo.jobId, error },
        })
      );
    }
  }
}

/**
 * Upload a single photo
 */
async function uploadPhoto(photo: QueuedPhoto): Promise<void> {
  const formData = new FormData();
  formData.append('photo', photo.blob, `${photo.type}.jpg`);
  formData.append('type', photo.type);

  const response = await fetch(`/api/field/job/${photo.jobId}/photos`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('[PhotoQueue] Upload successful:', result);
}

/**
 * Clear all photos from the queue (use with caution)
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
  console.log('[PhotoQueue] Queue cleared');
}

/**
 * Compress an image before queuing
 */
export async function compressImage(
  file: File | Blob,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(
              `[PhotoQueue] Compressed: ${file.size} -> ${blob.size} bytes`
            );
            resolve(blob);
          } else {
            reject(new Error('Compression failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load the image
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

// Auto-process queue when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[PhotoQueue] Online - processing queue');
    processQueue();
  });
}
