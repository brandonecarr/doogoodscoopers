"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PhotoCapture } from "@/components/portals/field/PhotoCapture";
import { PhotoQueue } from "@/components/portals/field/PhotoQueue";
import { ArrowLeft, Camera, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

interface Photo {
  id: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export default function PhotosPage() {
  const params = useParams();
  const stopId = params.stopId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [captureType, setCaptureType] = useState<"before" | "after" | "issue">("after");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      // First get route to find the job ID for this stop
      const routeRes = await fetch("/api/field/route");
      const routeData = await routeRes.json();

      if (!routeRes.ok) {
        setError(routeData.error || "Failed to load route");
        return;
      }

      const stop = routeData.stops?.find((s: { id: string }) => s.id === stopId);
      if (!stop || !stop.job) {
        setError("Stop not found");
        return;
      }

      setJobId(stop.job.id);

      // Get photos
      const photosRes = await fetch(`/api/field/job/${stop.job.id}/photos`);
      const photosData = await photosRes.json();

      if (photosRes.ok) {
        setPhotos(photosData.photos || []);
      } else {
        setError(photosData.error || "Failed to load photos");
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
      setError("Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handlePhotoTaken = (photoId: string, url: string) => {
    setPhotos((prev) => [
      ...prev,
      {
        id: photoId,
        url,
        type: captureType,
        uploadedAt: new Date().toISOString(),
      },
    ]);
    setShowCapture(false);
  };

  const handleDelete = async (photoId: string) => {
    if (!jobId) return;

    setDeleting(photoId);
    try {
      const res = await fetch(`/api/field/job/${jobId}/photos?photoId=${photoId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete photo");
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      setError("Failed to delete photo");
    } finally {
      setDeleting(null);
    }
  };

  const startCapture = (type: "before" | "after" | "issue") => {
    setCaptureType(type);
    setShowCapture(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  // Photo capture modal
  if (showCapture && jobId) {
    return (
      <PhotoCapture
        jobId={jobId}
        type={captureType}
        onPhotoTaken={handlePhotoTaken}
        onCancel={() => setShowCapture(false)}
      />
    );
  }

  // Group photos by type
  const beforePhotos = photos.filter((p) => p.type === "before");
  const afterPhotos = photos.filter((p) => p.type === "after");
  const issuePhotos = photos.filter((p) => p.type === "issue");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/app/field/route/${stopId}`}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Photos</h1>
          <p className="text-sm text-gray-500">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Photo queue status */}
      <PhotoQueue />

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Quick capture buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => startCapture("before")}
          className="bg-blue-100 text-blue-700 py-3 px-4 rounded-xl font-medium flex flex-col items-center gap-1"
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs">Before</span>
        </button>
        <button
          onClick={() => startCapture("after")}
          className="bg-green-100 text-green-700 py-3 px-4 rounded-xl font-medium flex flex-col items-center gap-1"
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs">After</span>
        </button>
        <button
          onClick={() => startCapture("issue")}
          className="bg-orange-100 text-orange-700 py-3 px-4 rounded-xl font-medium flex flex-col items-center gap-1"
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs">Issue</span>
        </button>
      </div>

      {/* Before Photos */}
      <PhotoSection
        title="Before Photos"
        photos={beforePhotos}
        type="before"
        onAdd={() => startCapture("before")}
        onDelete={handleDelete}
        deleting={deleting}
      />

      {/* After Photos */}
      <PhotoSection
        title="After Photos"
        photos={afterPhotos}
        type="after"
        onAdd={() => startCapture("after")}
        onDelete={handleDelete}
        deleting={deleting}
      />

      {/* Issue Photos */}
      <PhotoSection
        title="Issue Photos"
        photos={issuePhotos}
        type="issue"
        onAdd={() => startCapture("issue")}
        onDelete={handleDelete}
        deleting={deleting}
      />

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Photos Yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Take photos to document this job
          </p>
          <button
            onClick={() => startCapture("after")}
            className="bg-teal-600 text-white py-3 px-6 rounded-xl font-medium inline-flex items-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </button>
        </div>
      )}
    </div>
  );
}

// Photo section component
function PhotoSection({
  title,
  photos,
  type,
  onAdd,
  onDelete,
  deleting,
}: {
  title: string;
  photos: Photo[];
  type: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  if (photos.length === 0) {
    return null;
  }

  const bgColor = type === "before" ? "bg-blue-50" : type === "after" ? "bg-green-50" : "bg-orange-50";
  const textColor = type === "before" ? "text-blue-700" : type === "after" ? "text-green-700" : "text-orange-700";

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${textColor}`}>{title}</h3>
        <button
          onClick={onAdd}
          className={`p-2 rounded-lg ${bgColor} ${textColor}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
            <img
              src={photo.url}
              alt={`${type} photo`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => onDelete(photo.id)}
              disabled={deleting === photo.id}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg disabled:opacity-50"
            >
              {deleting === photo.id ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
