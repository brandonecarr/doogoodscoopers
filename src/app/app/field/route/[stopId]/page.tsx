"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DogWarningBanner } from "@/components/portals/field/DogWarningBanner";
import { JobActionButtons } from "@/components/portals/field/JobActionButtons";
import { OnTheWayButton } from "@/components/portals/field/OnTheWayButton";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Navigation,
  Key,
  FileText,
  Dog,
  Camera,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface DogInfo {
  id: string;
  name: string;
  breed: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
  specialInstructions: string | null;
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
  photos: Array<{ id: string; type: string }>;
  startedAt: string | null;
  completedAt: string | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zipCode: string;
    lat: number | null;
    lng: number | null;
    gateCode: string | null;
    gateLocation: string | null;
    accessNotes: string | null;
    specialInstructions: string | null;
  } | null;
  dogs: DogInfo[];
}

export default function StopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const stopId = params.stopId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetails | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");

  const fetchStop = useCallback(async () => {
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

      // Get full job details
      const jobRes = await fetch(`/api/field/job/${stop.job.id}`);
      const jobData = await jobRes.json();

      if (jobRes.ok) {
        setJob(jobData.job);
        setJobStatus(jobData.job.status);
      } else {
        setError(jobData.error || "Failed to load job details");
      }
    } catch (err) {
      console.error("Error fetching stop:", err);
      setError("Failed to load stop details");
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchStop();
  }, [fetchStop]);

  const handleStatusChange = (newStatus: string) => {
    setJobStatus(newStatus);
    if (newStatus === "COMPLETED" || newStatus === "SKIPPED") {
      // Go back to route list after short delay
      setTimeout(() => router.push("/app/field/route"), 1500);
    }
  };

  const openMaps = () => {
    if (!job?.location) return;
    const address = encodeURIComponent(
      `${job.location.addressLine1}, ${job.location.city}, ${job.location.state} ${job.location.zipCode}`
    );
    // Use coordinates if available, otherwise address
    const url = job.location.lat && job.location.lng
      ? `https://maps.google.com/?daddr=${job.location.lat},${job.location.lng}`
      : `https://maps.google.com/?daddr=${address}`;
    window.open(url, "_blank");
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
        <Link
          href="/app/field/route"
          className="flex items-center gap-2 text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Route
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Stop not found"}</p>
        </div>
      </div>
    );
  }

  const hasUnsafeDogs = job.dogs.some((dog) => !dog.isSafe);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/field/route"
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
          {job.scheduledTimeStart && (
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {job.scheduledTimeStart}
              {job.scheduledTimeEnd && ` - ${job.scheduledTimeEnd}`}
            </p>
          )}
        </div>
      </div>

      {/* Dog Warning */}
      {hasUnsafeDogs && <DogWarningBanner dogs={job.dogs} />}

      {/* Address Card */}
      {job.location && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{job.location.addressLine1}</p>
              {job.location.addressLine2 && (
                <p className="text-gray-600">{job.location.addressLine2}</p>
              )}
              <p className="text-gray-500">
                {job.location.city}, {job.location.state} {job.location.zipCode}
              </p>
            </div>
            <button
              onClick={openMaps}
              className="bg-blue-600 text-white p-3 rounded-xl"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Gate Code */}
      {job.location?.gateCode && (
        <div className="bg-yellow-50 rounded-xl p-4 flex items-center gap-3">
          <Key className="w-6 h-6 text-yellow-600" />
          <div>
            <p className="text-sm text-yellow-700">Gate Code</p>
            <p className="text-xl font-bold text-yellow-900">{job.location.gateCode}</p>
            {job.location.gateLocation && (
              <p className="text-sm text-yellow-700">{job.location.gateLocation}</p>
            )}
          </div>
        </div>
      )}

      {/* Access Notes */}
      {job.location?.accessNotes && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Access Notes</p>
              <p className="text-gray-600 mt-1">{job.location.accessNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {(job.location?.specialInstructions || job.notes) && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-700 mb-1">Special Instructions</p>
          <p className="text-blue-900">
            {job.location?.specialInstructions || job.notes}
          </p>
        </div>
      )}

      {/* Dogs Section */}
      {job.dogs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dog className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">
              Dogs ({job.dogs.length})
            </h3>
          </div>
          <div className="space-y-2">
            {job.dogs.map((dog) => (
              <div
                key={dog.id}
                className={`p-3 rounded-lg ${
                  dog.isSafe ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${dog.isSafe ? "text-green-900" : "text-red-900"}`}>
                      {dog.name}
                    </p>
                    {dog.breed && (
                      <p className={`text-sm ${dog.isSafe ? "text-green-700" : "text-red-700"}`}>
                        {dog.breed}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    dog.isSafe
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}>
                    {dog.isSafe ? "Safe" : "Caution"}
                  </span>
                </div>
                {dog.specialInstructions && (
                  <p className={`text-sm mt-2 ${dog.isSafe ? "text-green-700" : "text-red-700"}`}>
                    {dog.specialInstructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Info */}
      {job.client && (job.client.phone || job.client.email) && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
          <div className="space-y-2">
            {job.client.phone && (
              <a
                href={`tel:${job.client.phone}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <Phone className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">{job.client.phone}</span>
              </a>
            )}
            {job.client.email && (
              <a
                href={`mailto:${job.client.email}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <Mail className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">{job.client.email}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Photos link */}
      {jobStatus === "IN_PROGRESS" && (
        <Link
          href={`/app/field/route/${stopId}/photos`}
          className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Take Photos</p>
              <p className="text-sm text-gray-500">
                {job.photos.length} photo{job.photos.length !== 1 ? "s" : ""} uploaded
              </p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
        </Link>
      )}

      {/* Fixed action buttons at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-gray-100 via-gray-100">
        <div className="max-w-lg mx-auto space-y-3">
          {/* On the way button */}
          <OnTheWayButton
            jobId={job.id}
            status={jobStatus}
            onSent={() => setJobStatus("EN_ROUTE")}
          />

          {/* Job action buttons */}
          <JobActionButtons
            jobId={job.id}
            status={jobStatus}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
