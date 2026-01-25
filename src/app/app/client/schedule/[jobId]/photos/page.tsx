"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Download, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";

interface Photo {
  id: string;
  url: string;
  type: string;
  takenAt: string;
}

interface JobDetails {
  id: string;
  scheduledDate: string;
  status: string;
  location: {
    addressLine1: string;
    city: string;
  } | null;
  technician: {
    firstName: string;
    lastName: string;
  } | null;
}

export default function JobPhotosPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetails | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/client/schedule/${jobId}/photos`);
        const data = await res.json();

        if (res.ok) {
          setJob(data.job);
          setPhotos(data.photos || []);
        } else {
          setError(data.error || "Failed to load photos");
        }
      } catch (err) {
        console.error("Error fetching photos:", err);
        setError("Failed to load photos");
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      fetchPhotos();
    }
  }, [jobId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPhotoType = (type: string) => {
    switch (type) {
      case "BEFORE":
        return "Before";
      case "AFTER":
        return "After";
      case "ISSUE":
        return "Issue Found";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/client/schedule"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Service Photos</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Photos not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/client/schedule"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Photos</h1>
          <p className="text-sm text-gray-500">{formatDate(job.scheduledDate)}</p>
        </div>
      </div>

      {/* Job Info */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            {job.location && (
              <p className="font-medium text-gray-900">
                {job.location.addressLine1}, {job.location.city}
              </p>
            )}
            {job.technician && (
              <p className="text-sm text-gray-500">
                Service by {job.technician.firstName} {job.technician.lastName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Photos</h3>
          <p className="text-gray-500 text-sm">
            No photos were taken for this service visit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"
            >
              <Image
                src={photo.url}
                alt={formatPhotoType(photo.type)}
                fill
                className="object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <span className="text-white text-xs font-medium">
                  {formatPhotoType(photo.type)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <span className="text-white font-medium">
              {formatPhotoType(selectedPhoto.type)}
            </span>
            <a
              href={selectedPhoto.url}
              download
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
            >
              <Download className="w-5 h-5 text-white" />
            </a>
          </div>
          <div className="flex-1 relative">
            <Image
              src={selectedPhoto.url}
              alt={formatPhotoType(selectedPhoto.type)}
              fill
              className="object-contain"
            />
          </div>
          <div className="p-4 text-center">
            <p className="text-white/70 text-sm">
              {new Date(selectedPhoto.takenAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
