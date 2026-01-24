"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  MapPin,
  User,
  Calendar,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";

interface RouteStop {
  id: string;
  stop_order: number;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  job: {
    id: string;
    status: string;
    scheduled_date: string;
    client: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
    location: {
      id: string;
      address_line1: string;
      city: string;
      zip_code: string;
    } | null;
  } | null;
}

interface Route {
  id: string;
  name: string | null;
  status: string;
  route_date: string;
  start_time: string | null;
  end_time: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  notes: string | null;
  assigned_user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  stops: RouteStop[];
}

interface UnassignedJob {
  id: string;
  status: string;
  scheduled_date: string;
  price_cents: number;
  client: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  location: {
    id: string;
    address_line1: string;
    city: string;
    zip_code: string;
  } | null;
}

function RoutesContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam) {
      return dateParam;
    }
    return new Date().toISOString().split("T")[0];
  });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<UnassignedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [routesResponse, jobsResponse] = await Promise.all([
        fetch(`/api/admin/routes?date=${selectedDate}`),
        fetch(`/api/admin/jobs?date=${selectedDate}&unassigned=true`),
      ]);

      if (!routesResponse.ok || !jobsResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const routesData = await routesResponse.json();
      const jobsData = await jobsResponse.json();

      setRoutes(routesData.routes || []);
      setUnassignedJobs(jobsData.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const toggleRouteExpanded = (routeId: string) => {
    setExpandedRoutes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  };

  const createRoute = async () => {
    try {
      const response = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_date: selectedDate,
          name: newRouteName || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create route");
      }

      setShowCreateModal(false);
      setNewRouteName("");
      fetchRoutes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create route");
    }
  };

  const deleteRoute = async (routeId: string) => {
    if (!confirm("Are you sure you want to delete this route?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/routes?id=${routeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete route");
      }

      fetchRoutes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete route");
    }
  };

  const assignJobToRoute = async (jobId: string, routeId: string) => {
    try {
      const response = await fetch(`/api/admin/routes/${routeId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign job");
      }

      fetchRoutes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign job");
    }
  };

  const removeJobFromRoute = async (routeId: string, jobId: string) => {
    try {
      const response = await fetch(`/api/admin/routes/${routeId}/stops?jobId=${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove job");
      }

      fetchRoutes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove job");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600">Create and manage service routes</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Route
          </button>
        </div>
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

      {/* Content */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Routes List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Routes ({routes.length})
            </h2>

            {routes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No routes created
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a route to start organizing jobs.
                </p>
              </div>
            ) : (
              routes.map((route) => (
                <div
                  key={route.id}
                  className="bg-white rounded-lg shadow overflow-hidden"
                >
                  {/* Route Header */}
                  <div
                    className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRouteExpanded(route.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedRoutes.has(route.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {route.name || `Route ${route.id.slice(0, 8)}`}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {route.assigned_user && (
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {route.assigned_user.first_name} {route.assigned_user.last_name}
                            </span>
                          )}
                          <span>{route.stops?.length || 0} stops</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          route.status
                        )}`}
                      >
                        {route.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRoute(route.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Route Stops */}
                  {expandedRoutes.has(route.id) && (
                    <div className="p-4 space-y-2">
                      {route.stops && route.stops.length > 0 ? (
                        route.stops.map((stop) => (
                          <div
                            key={stop.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  #{stop.stop_order}
                                </span>
                                <span className="text-gray-900">
                                  {stop.job?.client
                                    ? `${stop.job.client.first_name} ${stop.job.client.last_name}`
                                    : "Unknown"}
                                </span>
                              </div>
                              {stop.job?.location && (
                                <p className="text-sm text-gray-500 truncate">
                                  {stop.job.location.address_line1}, {stop.job.location.city}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removeJobFromRoute(route.id, stop.job?.id || "")}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Remove from route"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-gray-500 py-4">
                          No stops assigned. Drag jobs here to add them.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Unassigned Jobs */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Unassigned Jobs ({unassignedJobs.length})
            </h2>

            {unassignedJobs.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">All jobs are assigned!</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {unassignedJobs.map((job) => (
                  <div key={job.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {job.client
                            ? `${job.client.first_name} ${job.client.last_name}`
                            : "Unknown"}
                        </h4>
                        {job.location && (
                          <p className="text-sm text-gray-500 truncate">
                            {job.location.address_line1}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          ${(job.price_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Assign to Route Dropdown */}
                    {routes.length > 0 && (
                      <div className="mt-2">
                        <select
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignJobToRoute(job.id, e.target.value);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">Assign to route...</option>
                          {routes.map((route) => (
                            <option key={route.id} value={route.id}>
                              {route.name || `Route ${route.id.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Route Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create New Route
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    placeholder="e.g., North Zone Morning"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoute}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  Create Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    }>
      <RoutesContent />
    </Suspense>
  );
}
