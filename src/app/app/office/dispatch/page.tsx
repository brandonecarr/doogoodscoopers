"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Phone,
  Truck,
  Play,
  Pause,
  SkipForward,
  RefreshCw,
} from "lucide-react";

interface Job {
  id: string;
  status: string;
  route_id: string | null;
  route_order: number | null;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  price_cents: number;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  location: {
    id: string;
    address_line1: string;
    city: string;
    zip_code: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  assigned_user: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface Route {
  id: string;
  name: string | null;
  status: string;
  route_date: string;
  start_time: string | null;
  end_time: string | null;
  assigned_user: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
}

interface DispatchData {
  date: string;
  jobs: Job[];
  routes: Route[];
  jobStats: {
    total: number;
    scheduled: number;
    en_route: number;
    in_progress: number;
    completed: number;
    skipped: number;
    canceled: number;
    unassigned: number;
  };
  routeStats: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
  };
  jobsByRoute: Record<string, Job[]>;
  revenueMetrics: {
    scheduled_total: number;
    completed_total: number;
    completion_rate: number;
  };
  activeStaff: Array<{
    id: string;
    status: string;
    clock_in: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      phone: string;
    } | null;
  }>;
}

function DispatchContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      return new Date(dateParam + "T00:00:00");
    }
    return new Date();
  });
  const [dispatchData, setDispatchData] = useState<DispatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDispatchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/dispatch?date=${currentDate.toISOString().split("T")[0]}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch dispatch data");
      }

      const data = await response.json();
      setDispatchData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchDispatchData();
  }, [fetchDispatchData]);

  const prevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700";
      case "EN_ROUTE":
        return "bg-purple-100 text-purple-700";
      case "SKIPPED":
        return "bg-yellow-100 text-yellow-700";
      case "CANCELED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4" />;
      case "IN_PROGRESS":
        return <Play className="w-4 h-4" />;
      case "EN_ROUTE":
        return <Truck className="w-4 h-4" />;
      case "SKIPPED":
        return <SkipForward className="w-4 h-4" />;
      case "CANCELED":
        return <Pause className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const renderJobCard = (job: Job) => (
    <div
      key={job.id}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                job.status
              )}`}
            >
              {getStatusIcon(job.status)}
              {job.status.replace("_", " ")}
            </span>
            {job.route_order && (
              <span className="text-xs text-gray-500">Stop #{job.route_order}</span>
            )}
          </div>

          <h4 className="mt-2 font-medium text-gray-900 truncate">
            {job.client
              ? `${job.client.first_name} ${job.client.last_name}`
              : "Unknown Client"}
          </h4>

          {job.location && (
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
              <span className="truncate">
                {job.location.address_line1}, {job.location.city}
              </span>
            </div>
          )}

          {job.client?.phone && (
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <Phone className="w-4 h-4 mr-1 flex-shrink-0" />
              {job.client.phone}
            </div>
          )}

          {job.assigned_user && (
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <User className="w-4 h-4 mr-1 flex-shrink-0" />
              {job.assigned_user.first_name} {job.assigned_user.last_name}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            ${(job.price_cents / 100).toFixed(2)}
          </div>
          {job.duration_minutes && (
            <div className="text-xs text-gray-500">{job.duration_minutes} min</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
          <p className="text-gray-600">Real-time view of today&apos;s operations</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevDay}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={goToToday}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              isToday(currentDate)
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Today
          </button>

          <button
            onClick={nextDay}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={fetchDispatchData}
            className="p-2 hover:bg-gray-100 rounded-lg ml-2"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Date Display */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">{formatDate(currentDate)}</h2>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center py-12 text-red-600">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Dispatch Content */}
      {!loading && !error && dispatchData && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Jobs</div>
              <div className="text-2xl font-bold text-gray-900">
                {dispatchData.jobStats.total}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-green-600">
                {dispatchData.jobStats.completed}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">In Progress</div>
              <div className="text-2xl font-bold text-blue-600">
                {dispatchData.jobStats.in_progress}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Scheduled</div>
              <div className="text-2xl font-bold text-gray-600">
                {dispatchData.jobStats.scheduled}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Completion</div>
              <div className="text-2xl font-bold text-teal-600">
                {dispatchData.revenueMetrics.completion_rate}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(dispatchData.revenueMetrics.completed_total / 100).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Active Staff */}
          {dispatchData.activeStaff.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Active Staff</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-4">
                  {dispatchData.activeStaff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2"
                    >
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="font-medium text-green-800">
                        {staff.user
                          ? `${staff.user.first_name} ${staff.user.last_name}`
                          : "Unknown"}
                      </span>
                      <span className="text-xs text-green-600">
                        {staff.status === "ON_BREAK" ? "On Break" : "Active"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Routes & Jobs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Unassigned Jobs */}
            {dispatchData.jobsByRoute.unassigned &&
              dispatchData.jobsByRoute.unassigned.length > 0 && (
                <div className="bg-orange-50 rounded-lg shadow overflow-hidden">
                  <div className="px-4 py-3 border-b border-orange-200 bg-orange-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-orange-800">
                        Unassigned Jobs
                      </h3>
                      <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-sm">
                        {dispatchData.jobsByRoute.unassigned.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                    {dispatchData.jobsByRoute.unassigned.map(renderJobCard)}
                  </div>
                </div>
              )}

            {/* Routes */}
            {dispatchData.routes.map((route) => {
              const routeJobs = dispatchData.jobsByRoute[route.id] || [];
              const completedCount = routeJobs.filter(
                (j) => j.status === "COMPLETED"
              ).length;

              return (
                <div
                  key={route.id}
                  className="bg-white rounded-lg shadow overflow-hidden"
                >
                  <div
                    className={`px-4 py-3 border-b ${
                      route.status === "IN_PROGRESS"
                        ? "bg-blue-50 border-blue-200"
                        : route.status === "COMPLETED"
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {route.name || `Route ${route.id.slice(0, 8)}`}
                        </h3>
                        {route.assigned_user && (
                          <p className="text-sm text-gray-600">
                            {route.assigned_user.first_name}{" "}
                            {route.assigned_user.last_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            route.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-700"
                              : route.status === "COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {route.status.replace("_", " ")}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                          {completedCount}/{routeJobs.length} done
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                    {routeJobs.length > 0 ? (
                      routeJobs.map(renderJobCard)
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No jobs assigned
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {dispatchData.routes.length === 0 &&
              (!dispatchData.jobsByRoute.unassigned ||
                dispatchData.jobsByRoute.unassigned.length === 0) && (
                <div className="col-span-full text-center py-12">
                  <Truck className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No jobs scheduled
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    There are no jobs or routes scheduled for this date.
                  </p>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DispatchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    }>
      <DispatchContent />
    </Suspense>
  );
}
