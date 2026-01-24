/**
 * Service Worker Registration
 *
 * Handles registering and updating the service worker for the field portal PWA.
 */

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let updateAvailable = false;

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerStatus> {
  const status: ServiceWorkerStatus = {
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
    registration: null,
  };

  if (!status.isSupported) {
    console.log('[PWA] Service workers not supported');
    return status;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/app/field',
    });

    swRegistration = registration;
    status.registration = registration;
    status.isRegistered = true;

    console.log('[PWA] Service worker registered with scope:', registration.scope);

    // Check if already installed
    if (registration.active) {
      status.isInstalled = true;
    }

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable = true;
            console.log('[PWA] New version available');
            // Notify the app about the update
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Handle controller change (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, reloading...');
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'PHOTO_UPLOADED') {
        window.dispatchEvent(new CustomEvent('photo-uploaded', {
          detail: { id: event.data.id }
        }));
      }
    });

    return status;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return status;
  }
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  try {
    await swRegistration.update();
    return updateAvailable;
  } catch (error) {
    console.error('[PWA] Failed to check for updates:', error);
    return false;
  }
}

/**
 * Apply pending update (skip waiting)
 */
export function applyUpdate(): void {
  if (!swRegistration?.waiting) {
    return;
  }

  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Get the count of queued photos
 */
export async function getQueuedPhotoCount(): Promise<number> {
  const controller = navigator.serviceWorker.controller;
  if (!controller) {
    return 0;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data.count || 0);
    };

    controller.postMessage(
      { type: 'GET_QUEUE_COUNT' },
      [channel.port2]
    );

    // Timeout after 1 second
    setTimeout(() => resolve(0), 1000);
  });
}

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Check if the device supports PWA installation
 */
export function canInstall(): boolean {
  // Check if beforeinstallprompt event has been captured
  return !!(window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
}

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture the install prompt for later use
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
}

/**
 * Trigger the PWA install prompt
 */
export async function promptInstall(): Promise<boolean> {
  const deferredPrompt = (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

  if (!deferredPrompt) {
    return false;
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  // Clear the prompt
  (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = undefined;

  return outcome === 'accepted';
}
