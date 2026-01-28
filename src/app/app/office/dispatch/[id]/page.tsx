"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

interface JobDetails {
  id: string;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  internalNotes: string | null;
  skipReason: string | null;
  priceCents: number | null;
  photos: string[] | null;
  metadata: Record<string, unknown> | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    status: string;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zipCode: string;
    gateCode: string | null;
    gateLocation: string | null;
    accessNotes: string | null;
    dogs: Array<{
      id: string;
      name: string;
      breed: string | null;
      is_active: boolean;
    }>;
  } | null;
  subscription: {
    id: string;
    frequency: string;
    pricePerVisitCents: number;
    status: string;
    plan: {
      id: string;
      name: string;
      frequency: string;
    } | null;
  } | null;
  assignedUser: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
  route: {
    id: string;
    name: string;
    status: string;
  } | null;
  lastServiceDate: string | null;
  jobType: string;
  servicePlan: string;
  pricingPlan: string;
  revenue: string;
  estimatedMinutes: number;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "text-gray-600",
  EN_ROUTE: "text-orange-500",
  IN_PROGRESS: "text-blue-500",
  COMPLETED: "text-green-600",
  SKIPPED: "text-yellow-600",
  CANCELED: "text-gray-400",
  MISSED: "text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Pending",
  EN_ROUTE: "Dispatched",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELED: "Canceled",
  MISSED: "Missed",
};

export default function JobViewPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetails | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/jobs/${jobId}`);
      const data = await res.json();

      if (res.ok) {
        setJob(data.job);
      } else {
        setError(data.error || "Failed to load job");
      }
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId, fetchJob]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No data";
    return new Date(dateString).toLocaleDateString("en-CA"); // YYYY-MM-DD format
  };

  const formatDateTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return "No data";
    return new Date(dateTimeString).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(",", "");
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "-";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const formatEstimatedTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Get number of active dogs for service plan display
  const getServicePlanDisplay = () => {
    if (!job) return "";
    const activeDogs = job.location?.dogs?.filter(d => d.is_active)?.length || 0;
    const frequency = job.subscription?.frequency || job.servicePlan;
    return `${activeDogs}d-${frequency}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error || "Job not found"}
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500">Job ID:</div>
          <h1 className="text-2xl font-bold text-gray-900">{job.id.slice(0, 8)}</h1>
          <p className="text-gray-600 mt-1">
            {job.client?.fullName?.toUpperCase()} on {job.pricingPlan?.toUpperCase()} - {getServicePlanDisplay()}
          </p>
          <p className={`text-lg font-semibold mt-2 ${STATUS_COLORS[job.status] || "text-gray-500"}`}>
            {STATUS_LABELS[job.status] || job.status}
          </p>
        </div>
        <Link
          href="/app/office/dispatch"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Details Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <DetailRow label="Job ID" value={job.id.slice(0, 8)} />
          <DetailRow
            label="Status"
            value={STATUS_LABELS[job.status] || job.status}
            valueClassName={STATUS_COLORS[job.status]}
          />
          <DetailRow label="Client Name" value={job.client?.fullName || "Unknown"} />
          <DetailRow label="Assigned To" value={job.assignedUser?.fullName || "Unassigned"} />
          <DetailRow
            label="Note To Client"
            value={job.notes}
            emptyText="No data"
          />
          <DetailRow
            label="Note To Office"
            value={job.internalNotes}
            emptyText="No data"
          />
          <DetailRow label="Schedule Date" value={formatDate(job.scheduledDate)} />
          <DetailRow
            label="Last Service Date"
            value={formatDate(job.lastServiceDate)}
            emptyText="No data"
          />
          <DetailRow
            label="Start Job Time"
            value={job.startedAt ? formatDateTime(job.startedAt) : null}
            emptyText="No data"
          />
          <DetailRow
            label="Complete Job Time"
            value={job.completedAt ? formatDateTime(job.completedAt) : null}
            emptyText="No data"
          />
          <DetailRow label="Estimated Time" value={formatEstimatedTime(job.estimatedMinutes)} />
          <DetailRow label="Spent Time" value={formatDuration(job.durationMinutes)} />
          <DetailRow label="Job Type" value={job.jobType} />
          <DetailRow label="Service Plan" value={getServicePlanDisplay()} />
          <DetailRow label="Pricing Plan" value={job.pricingPlan} />
          <DetailRow label="Address" value={job.location?.addressLine1 || "No address"} />
          <DetailRow label="City" value={job.location?.city || ""} />
          <DetailRow label="Zip" value={job.location?.zipCode || ""} />
          <DetailRow label="Revenue" value={`$${job.revenue}`} />
        </div>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string | null | undefined;
  emptyText?: string;
  valueClassName?: string;
}

function DetailRow({ label, value, emptyText = "", valueClassName = "" }: DetailRowProps) {
  const displayValue = value || emptyText;
  const isEmpty = !value && emptyText;

  return (
    <div className="flex px-6 py-3">
      <div className="w-48 flex-shrink-0 text-gray-500">{label}</div>
      <div className={`flex-1 ${isEmpty ? "text-gray-400 italic" : valueClassName || "text-gray-900"}`}>
        {displayValue}
      </div>
    </div>
  );
}
