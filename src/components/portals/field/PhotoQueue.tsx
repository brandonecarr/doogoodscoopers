"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { usePWA } from "./PWAProvider";

interface PhotoQueueProps {
  compact?: boolean;
}

export function PhotoQueue({ compact = false }: PhotoQueueProps) {
  const { isOnline, queuedPhotos } = usePWA();

  if (queuedPhotos === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        isOnline
          ? "bg-blue-100 text-blue-700"
          : "bg-yellow-100 text-yellow-700"
      }`}>
        {isOnline ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <CloudOff className="w-3 h-3" />
        )}
        <span>{queuedPhotos}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 flex items-center gap-3 ${
      isOnline
        ? "bg-blue-50 border border-blue-200"
        : "bg-yellow-50 border border-yellow-200"
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        isOnline ? "bg-blue-100" : "bg-yellow-100"
      }`}>
        {isOnline ? (
          <Loader2 className={`w-5 h-5 animate-spin ${isOnline ? "text-blue-600" : "text-yellow-600"}`} />
        ) : (
          <CloudOff className="w-5 h-5 text-yellow-600" />
        )}
      </div>
      <div className="flex-1">
        <p className={`font-medium ${isOnline ? "text-blue-900" : "text-yellow-900"}`}>
          {queuedPhotos} photo{queuedPhotos !== 1 ? "s" : ""} pending
        </p>
        <p className={`text-sm ${isOnline ? "text-blue-700" : "text-yellow-700"}`}>
          {isOnline ? "Uploading in background..." : "Will upload when online"}
        </p>
      </div>
      {isOnline && (
        <Cloud className="w-5 h-5 text-blue-500" />
      )}
    </div>
  );
}
