"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, CheckCircle, XCircle, Clock, MapPin, Camera, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  scheduledDate: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  skipReason: string | null;
  photoCount: number;
  location: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;
  technician: {
    firstName: string;
    lastName: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ViewType = "upcoming" | "past";

export default function SchedulePage() {
  const [view, setView] = useState<ViewType>("upcoming");
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

  const fetchSchedule = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/client/schedule?view=${view}&page=${pageNum}`);
      const data = await res.json();

      if (res.ok) {
        if (append) {
          setJobs((prev) => [...prev, ...data.jobs]);
        } else {
          setJobs(data.jobs || []);
        }
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to load schedule");
      }
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [view]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const loadMore = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      fetchSchedule(pagination.page + 1, true);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return { color: "bg-blue-100 text-blue-700", icon: Clock, label: "Scheduled" };
      case "EN_ROUTE":
        return { color: "bg-purple-100 text-purple-700", icon: Clock, label: "On The Way" };
      case "IN_PROGRESS":
        return { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: "In Progress" };
      case "COMPLETED":
        return { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Completed" };
      case "SKIPPED":
        return { color: "bg-red-100 text-red-700", icon: XCircle, label: "Skipped" };
      case "CANCELED":
        return { color: "bg-gray-100 text-gray-700", icon: XCircle, label: "Canceled" };
      default:
        return { color: "bg-gray-100 text-gray-700", icon: Clock, label: status };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Schedule</h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView("upcoming")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === "upcoming"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setView("past")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === "past"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Past
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {jobs.length === 0 && !error && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {view === "upcoming" ? "No Upcoming Services" : "No Past Services"}
          </h3>
          <p className="text-gray-500 text-sm">
            {view === "upcoming"
              ? "Your next scheduled service will appear here"
              : "Your service history will appear here"}
          </p>
        </div>
      )}

      {/* Job List */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const status = getStatusBadge(job.status);
          const StatusIcon = status.icon;

          return (
            <div
              key={job.id}
              className="bg-white rounded-xl shadow-sm p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{formatDate(job.scheduledDate)}</p>
                  {job.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{job.location.addressLine1}, {job.location.city}</span>
                    </div>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>

              {job.technician && (
                <p className="text-sm text-gray-600">
                  Technician: {job.technician.firstName} {job.technician.lastName}
                </p>
              )}

              {job.completedAt && (
                <p className="text-sm text-gray-500 mt-1">
                  Completed at {new Date(job.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              {job.skipReason && (
                <div className="mt-2 bg-red-50 rounded-lg p-2">
                  <p className="text-sm text-red-700">Reason: {job.skipReason}</p>
                </div>
              )}

              {job.photoCount > 0 && (
                <Link
                  href={`/app/client/schedule/${job.id}/photos`}
                  className="mt-3 flex items-center gap-2 text-sm text-teal-600 font-medium"
                >
                  <Camera className="w-4 h-4" />
                  View {job.photoCount} photo{job.photoCount > 1 ? "s" : ""}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Load More */}
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
