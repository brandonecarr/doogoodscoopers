"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, CheckCircle, XCircle, Calendar, MapPin, Camera, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  skipReason: string | null;
  photoCount: number;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    city: string;
    zipCode: string;
  } | null;
  route: {
    id: string;
    name: string | null;
    date: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchHistory = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/field/history?page=${page}&limit=20`);
      const data = await res.json();

      if (res.ok) {
        if (append) {
          setJobs((prev) => [...prev, ...data.jobs]);
        } else {
          setJobs(data.jobs || []);
        }
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to load history");
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to load history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const loadMore = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      fetchHistory(pagination.page + 1, true);
    }
  };

  // Group jobs by date
  const jobsByDate = jobs.reduce<Record<string, Job[]>>((acc, job) => {
    const date = job.completedAt
      ? new Date(job.completedAt).toLocaleDateString()
      : job.scheduledDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(job);
    return acc;
  }, {});

  const sortedDates = Object.keys(jobsByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/field"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Job History</h1>
          <p className="text-sm text-gray-500">{pagination.total} completed jobs</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && !error && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Yet</h3>
          <p className="text-gray-500 text-sm">
            Completed jobs will appear here
          </p>
        </div>
      )}

      {/* Job list grouped by date */}
      {sortedDates.map((date) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDateHeader(date)}</span>
          </div>
          <div className="space-y-2">
            {jobsByDate[date].map((job) => (
              <JobHistoryCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      ))}

      {/* Load more button */}
      {pagination.page < pagination.totalPages && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full bg-white rounded-xl shadow-sm p-4 text-center text-gray-600 font-medium flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
          ) : (
            <>
              <ChevronDown className="w-5 h-5" />
              Load More
            </>
          )}
        </button>
      )}
    </div>
  );
}

function JobHistoryCard({ job }: { job: Job }) {
  const isCompleted = job.status === "COMPLETED";

  return (
    <Link
      href={`/app/field/history/${job.id}`}
      className="block bg-white rounded-xl shadow-sm p-4"
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isCompleted ? "bg-green-100" : "bg-red-100"
        }`}>
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 truncate">
              {job.client
                ? `${job.client.firstName || ""} ${job.client.lastName || ""}`.trim() || "Unknown"
                : "Unknown Client"}
            </h3>
            {job.photoCount > 0 && (
              <div className="flex items-center gap-1 text-gray-400 text-sm">
                <Camera className="w-4 h-4" />
                <span>{job.photoCount}</span>
              </div>
            )}
          </div>

          {job.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {job.location.addressLine1}, {job.location.city}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isCompleted
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}>
              {isCompleted ? "Completed" : "Skipped"}
            </span>
            {job.completedAt && (
              <span className="text-xs text-gray-400">
                {new Date(job.completedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {job.skipReason && (
            <p className="text-sm text-red-600 mt-2 italic">
              &quot;{job.skipReason}&quot;
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
