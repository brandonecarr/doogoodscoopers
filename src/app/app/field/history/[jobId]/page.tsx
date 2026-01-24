"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Camera,
  Dog,
  FileText,
} from "lucide-react";
import Link from "next/link";

interface Photo {
  id: string;
  url: string;
  type: string;
  uploadedAt: string;
}

interface JobDetails {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
  notes: string | null;
  internalNotes: string | null;
  skipReason: string | null;
  photos: Photo[];
  startedAt: string | null;
  completedAt: string | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zipCode: string;
  } | null;
  dogs: Array<{
    id: string;
    name: string;
    breed: string | null;
  }>;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetails | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/field/job/${jobId}`);
      const data = await res.json();

      if (res.ok) {
        setJob(data.job);
      } else {
        setError(data.error || "Failed to load job");
      }
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

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
        <Link
          href="/app/field/history"
          className="flex items-center gap-2 text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to History
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Job not found"}</p>
        </div>
      </div>
    );
  }

  const isCompleted = job.status === "COMPLETED";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/field/history"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {job.client
              ? `${job.client.firstName || ""} ${job.client.lastName || ""}`.trim()
              : "Job Details"}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(job.scheduledDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        isCompleted ? "bg-green-100" : "bg-red-100"
      }`}>
        {isCompleted ? (
          <CheckCircle className="w-8 h-8 text-green-600" />
        ) : (
          <XCircle className="w-8 h-8 text-red-600" />
        )}
        <div>
          <p className={`font-bold text-lg ${isCompleted ? "text-green-800" : "text-red-800"}`}>
            {isCompleted ? "Completed" : "Skipped"}
          </p>
          {job.completedAt && (
            <p className={`text-sm ${isCompleted ? "text-green-700" : "text-red-700"}`}>
              {new Date(job.completedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Skip Reason */}
      {job.skipReason && (
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">Skip Reason:</p>
          <p className="text-red-900 mt-1">{job.skipReason}</p>
        </div>
      )}

      {/* Time info */}
      {(job.startedAt || job.completedAt) && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Time</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {job.startedAt && (
              <div>
                <p className="text-sm text-gray-500">Started</p>
                <p className="font-medium text-gray-900">
                  {new Date(job.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
            {job.completedAt && (
              <div>
                <p className="text-sm text-gray-500">Finished</p>
                <p className="font-medium text-gray-900">
                  {new Date(job.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
          {job.startedAt && job.completedAt && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-gray-900">
                {formatDuration(new Date(job.startedAt), new Date(job.completedAt))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Address */}
      {job.location && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Location</h3>
          </div>
          <p className="text-gray-700">{job.location.addressLine1}</p>
          {job.location.addressLine2 && (
            <p className="text-gray-600">{job.location.addressLine2}</p>
          )}
          <p className="text-gray-500">
            {job.location.city}, {job.location.state} {job.location.zipCode}
          </p>
        </div>
      )}

      {/* Dogs */}
      {job.dogs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dog className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Dogs ({job.dogs.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {job.dogs.map((dog) => (
              <span
                key={dog.id}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
              >
                {dog.name}
                {dog.breed && <span className="text-gray-400 ml-1">({dog.breed})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {job.internalNotes && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Notes</h3>
          </div>
          <p className="text-gray-700">{job.internalNotes}</p>
        </div>
      )}

      {/* Photos */}
      {job.photos && job.photos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Photos ({job.photos.length})</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {job.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                <img
                  src={photo.url}
                  alt={`${photo.type} photo`}
                  className="w-full h-full object-cover"
                />
                <span className={`absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full ${
                  photo.type === "before"
                    ? "bg-blue-500 text-white"
                    : photo.type === "after"
                    ? "bg-green-500 text-white"
                    : "bg-orange-500 text-white"
                }`}>
                  {photo.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
