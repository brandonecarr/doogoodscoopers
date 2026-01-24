"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { queuePhoto, compressImage } from "@/lib/pwa/photo-queue";
import { usePWA } from "./PWAProvider";

interface PhotoCaptureProps {
  jobId: string;
  type: "before" | "after" | "issue";
  onPhotoTaken: (photoId: string, url: string) => void;
  onCancel: () => void;
}

export function PhotoCapture({ jobId, type, onPhotoTaken, onCancel }: PhotoCaptureProps) {
  const { isOnline } = usePWA();
  const [mode, setMode] = useState<"camera" | "preview" | "uploading">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Convert to blob and compress
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
        "image/jpeg",
        0.9
      );
    });

    // Compress the image
    const compressedBlob = await compressImage(blob);

    // Create preview URL
    const previewUrl = URL.createObjectURL(compressedBlob);

    setCapturedImage(previewUrl);
    setCapturedBlob(compressedBlob);
    setMode("preview");
    stopCamera();
  }, [stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setMode("camera");
    startCamera();
  }, [capturedImage, startCamera]);

  // Upload photo
  const uploadPhoto = useCallback(async () => {
    if (!capturedBlob) return;

    setMode("uploading");
    setError(null);

    try {
      if (isOnline) {
        // Upload directly
        const formData = new FormData();
        formData.append("photo", capturedBlob, `${type}-${Date.now()}.jpg`);
        formData.append("type", type);

        const res = await fetch(`/api/field/job/${jobId}/photos`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok) {
          onPhotoTaken(data.photo.id, data.photo.url);
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } else {
        // Queue for later upload
        const photoId = await queuePhoto(jobId, capturedBlob, type);
        onPhotoTaken(photoId, capturedImage!);
      }
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError(err instanceof Error ? err.message : "Failed to upload photo");
      setMode("preview");
    }
  }, [capturedBlob, capturedImage, isOnline, jobId, onPhotoTaken, type]);

  // Initialize camera on mount
  useState(() => {
    startCamera();
  });

  // Cleanup on unmount
  useState(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  });

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 text-white">
        <button onClick={onCancel} className="p-2">
          <X className="w-6 h-6" />
        </button>
        <span className="font-medium capitalize">{type} Photo</span>
        <div className="w-10" />
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-16 left-4 right-4 bg-red-500 text-white p-3 rounded-lg z-10">
          {error}
        </div>
      )}

      {/* Camera / Preview */}
      <div className="flex-1 relative">
        {mode === "camera" && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              onLoadedMetadata={() => startCamera()}
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}

        {(mode === "preview" || mode === "uploading") && capturedImage && (
          <img
            src={capturedImage}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {mode === "uploading" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-2" />
              <p>{isOnline ? "Uploading..." : "Queuing for upload..."}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/50">
        {mode === "camera" && (
          <div className="flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center"
            >
              <Camera className="w-8 h-8 text-gray-900" />
            </button>
          </div>
        )}

        {mode === "preview" && (
          <div className="flex justify-center gap-8">
            <button
              onClick={retakePhoto}
              className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={uploadPhoto}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
            >
              <Check className="w-8 h-8 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Offline indicator */}
      {!isOnline && mode !== "uploading" && (
        <div className="absolute bottom-28 left-4 right-4 bg-yellow-500 text-white p-2 rounded-lg text-center text-sm">
          Offline - Photo will be uploaded when online
        </div>
      )}
    </div>
  );
}
