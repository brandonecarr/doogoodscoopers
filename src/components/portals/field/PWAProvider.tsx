"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { Wifi, WifiOff, RefreshCw, Download } from "lucide-react";
import {
  registerServiceWorker,
  applyUpdate,
  isStandalone,
  promptInstall,
  getQueuedPhotoCount,
} from "@/lib/pwa";

interface PWAContextValue {
  isOnline: boolean;
  isInstalled: boolean;
  updateAvailable: boolean;
  queuedPhotos: number;
  applyUpdate: () => void;
  promptInstall: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextValue>({
  isOnline: true,
  isInstalled: false,
  updateAvailable: false,
  queuedPhotos: 0,
  applyUpdate: () => {},
  promptInstall: async () => false,
});

export function usePWA() {
  return useContext(PWAContext);
}

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [queuedPhotos, setQueuedPhotos] = useState(0);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    setIsInstalled(isStandalone());

    // Register service worker
    registerServiceWorker().then((status) => {
      console.log("[PWA] Registration status:", status);
    });

    // Online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Update available listener
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
    };
    window.addEventListener("sw-update-available", handleUpdateAvailable);

    // Install prompt listener
    const handleInstallable = () => {
      setCanInstall(true);
    };
    window.addEventListener("pwa-installable", handleInstallable);

    // Photo upload listeners
    const updateQueueCount = async () => {
      const count = await getQueuedPhotoCount();
      setQueuedPhotos(count);
    };

    window.addEventListener("photo-upload-success", updateQueueCount);
    window.addEventListener("photo-upload-error", updateQueueCount);

    // Initial queue count
    updateQueueCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sw-update-available", handleUpdateAvailable);
      window.removeEventListener("pwa-installable", handleInstallable);
      window.removeEventListener("photo-upload-success", updateQueueCount);
      window.removeEventListener("photo-upload-error", updateQueueCount);
    };
  }, []);

  const handleApplyUpdate = () => {
    applyUpdate();
  };

  const handlePromptInstall = async () => {
    const result = await promptInstall();
    if (result) {
      setCanInstall(false);
      setIsInstalled(true);
    }
    return result;
  };

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isInstalled,
        updateAvailable,
        queuedPhotos,
        applyUpdate: handleApplyUpdate,
        promptInstall: handlePromptInstall,
      }}
    >
      {children}

      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4" />
          <span>You&apos;re offline. Changes will sync when connected.</span>
          <button
            onClick={() => setShowOfflineBanner(false)}
            className="ml-2 text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Update Available Banner */}
      {updateAvailable && (
        <div className="fixed bottom-20 left-4 right-4 z-[100] bg-teal-600 text-white rounded-lg shadow-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm font-medium">Update available</span>
          </div>
          <button
            onClick={handleApplyUpdate}
            className="bg-white text-teal-600 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100"
          >
            Update Now
          </button>
        </div>
      )}

      {/* Install Prompt */}
      {canInstall && !isInstalled && (
        <div className="fixed bottom-20 left-4 right-4 z-[100] bg-navy-900 text-white rounded-lg shadow-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">Install app for better experience</span>
          </div>
          <button
            onClick={handlePromptInstall}
            className="bg-teal-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-teal-600"
          >
            Install
          </button>
        </div>
      )}

      {/* Online Status Indicator (subtle) */}
      {!showOfflineBanner && (
        <div className="fixed bottom-[72px] right-4 z-50">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isOnline
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
            {queuedPhotos > 0 && (
              <span className="ml-1 bg-amber-500 text-white px-1.5 rounded-full">
                {queuedPhotos}
              </span>
            )}
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
