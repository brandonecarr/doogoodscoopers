"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Calendar,
  MoreVertical,
  RefreshCw,
  CheckCircle,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { GoogleMapsProvider } from "@/components/route-planner/GoogleMapsProvider";
import {
  RouteManagerMap,
  RouteData,
  RouteStop,
} from "@/components/route-manager/RouteManagerMap";

interface Tech {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  color: string;
}

interface RouteSummary {
  totalRoutes: number;
  totalStops: number;
  completedStops: number;
}

function RouteManagerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam) {
      return dateParam;
    }
    return new Date().toISOString().split("T")[0];
  });

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [bounds, setBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [summary, setSummary] = useState<RouteSummary>({
    totalRoutes: 0,
    totalStops: 0,
    completedStops: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [stopMenuOpen, setStopMenuOpen] = useState<string | null>(null);
  const stopMenuRef = useRef<HTMLDivElement>(null);

  // Fetch route data
  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedTechId) {
        params.set("techId", selectedTechId);
      }

      const response = await fetch(`/api/admin/routes/map-data?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data = await response.json();
      setRoutes(data.routes || []);
      setTechs(data.techs || []);
      setBounds(data.bounds);
      setSummary(data.summary || { totalRoutes: 0, totalStops: 0, completedStops: 0 });

      // Auto-select first route if none selected
      if (data.routes?.length > 0 && !selectedRouteId) {
        setSelectedRouteId(data.routes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTechId, selectedRouteId]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (stopMenuRef.current && !stopMenuRef.current.contains(target)) {
        setStopMenuOpen(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Navigate date
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  // Handle stop click from map
  const handleStopClick = (stop: RouteStop, route: RouteData) => {
    setSelectedRouteId(route.id);
    setSelectedStopId(stop.id);
  };

  // Handle tech selection
  const handleTechSelect = (techId: string | null) => {
    setSelectedTechId(techId);
    setSelectedRouteId(null);
  };

  // Get selected route
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  // Stop menu actions
  const handleStopAction = async (action: string, stop: RouteStop, route: RouteData) => {
    setStopMenuOpen(null);

    switch (action) {
      case "view":
        router.push(`/app/office/dispatch/${stop.job?.id}`);
        break;
      case "reclean":
        // TODO: Implement reclean job functionality
        alert("Reclean job functionality coming soon");
        break;
      case "reschedule":
        // TODO: Implement reschedule functionality
        alert("Reschedule functionality coming soon");
        break;
      case "geolocation":
        if (stop.location?.latitude && stop.location?.longitude) {
          window.open(
            `https://www.google.com/maps?q=${stop.location.latitude},${stop.location.longitude}`,
            "_blank"
          );
        }
        break;
    }
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <GoogleMapsProvider>
      <div className="h-[calc(100vh-140px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Route Manager</h1>
            <p className="text-gray-600">View and manage daily routes</p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Previous day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-0 focus:ring-0 p-0 text-gray-900 font-medium"
              />
            </div>

            <button
              onClick={() => changeDate(1)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Next day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className="px-3 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg"
            >
              Today
            </button>

            <button
              onClick={fetchRoutes}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Date Display */}
        <div className="text-center mb-4">
          <p className="text-lg font-semibold text-gray-800">
            {formatDisplayDate(selectedDate)}
          </p>
          <p className="text-sm text-gray-500">
            {summary.totalRoutes} route{summary.totalRoutes !== 1 ? "s" : ""} &bull;{" "}
            {summary.completedStops}/{summary.totalStops} stops completed
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
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

        {/* Main Content */}
        {!loading && !error && (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Map Section */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              {/* Map Controls */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMapType("roadmap")}
                    className={`px-3 py-1 text-sm font-medium rounded-lg ${
                      mapType === "roadmap"
                        ? "bg-teal-100 text-teal-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Map
                  </button>
                  <button
                    onClick={() => setMapType("satellite")}
                    className={`px-3 py-1 text-sm font-medium rounded-lg ${
                      mapType === "satellite"
                        ? "bg-teal-100 text-teal-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Satellite
                  </button>
                </div>

                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg"
                  onClick={() => alert("AI Route Optimization coming soon!")}
                >
                  <Sparkles className="w-4 h-4" />
                  Reoptimize All Routes
                </button>
              </div>

              {/* Map */}
              <div className="h-[calc(100%-45px)]">
                {routes.length > 0 ? (
                  <RouteManagerMap
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    selectedStopId={selectedStopId}
                    bounds={bounds}
                    onStopClick={handleStopClick}
                    showRouteLines={true}
                    mapType={mapType}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No routes for this date</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Create a route or select a different date
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Stop List */}
            <div className="w-96 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col min-h-0">
              {/* Tech/Route Selector */}
              <div className="px-4 py-3 border-b border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Tech
                </label>
                <select
                  value={selectedTechId || ""}
                  onChange={(e) => handleTechSelect(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                >
                  <option value="">All Techs</option>
                  {techs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Route Tabs */}
              {routes.length > 0 && (
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 ${
                        selectedRouteId === route.id
                          ? "border-teal-500 text-teal-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: route.color }}
                        />
                        {route.assignedUser?.firstName || route.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              {selectedRoute && (
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        {selectedRoute.assignedUser?.fullName || "Unassigned"}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedRoute.progress.completed}/{selectedRoute.progress.total} completed
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-300"
                      style={{ width: `${selectedRoute.progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stop List */}
              <div className="flex-1 overflow-y-auto">
                {selectedRoute ? (
                  selectedRoute.stops.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {selectedRoute.stops.map((stop) => (
                        <div
                          key={stop.id}
                          className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                            selectedStopId === stop.id ? "bg-teal-50" : ""
                          }`}
                          onClick={() => setSelectedStopId(stop.id)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Stop Number */}
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                              style={{
                                backgroundColor:
                                  stop.job?.status === "COMPLETED"
                                    ? "#9CA3AF"
                                    : selectedRoute.color,
                              }}
                            >
                              {stop.stopNumber}
                            </span>

                            {/* Stop Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {stop.client?.fullName || "Unknown"}
                                </h4>
                                {stop.job?.status === "COMPLETED" && (
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                )}
                                {stop.job?.status === "IN_PROGRESS" && (
                                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate">
                                {stop.location?.addressLine1}
                              </p>
                              <p className="text-xs text-gray-400">
                                {stop.location?.city}, {stop.location?.state} {stop.location?.zipCode}
                              </p>
                            </div>

                            {/* Three-dot Menu */}
                            <div className="relative" ref={stopMenuOpen === stop.id ? stopMenuRef : null}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStopMenuOpen(stopMenuOpen === stop.id ? null : stop.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {stopMenuOpen === stop.id && (
                                <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStopAction("reclean", stop, selectedRoute);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Reclean Job
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStopAction("reschedule", stop, selectedRoute);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Change Schedule
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStopAction("view", stop, selectedRoute);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    View Job Details
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStopAction("geolocation", stop, selectedRoute);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    View Geolocation Details
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <MapPin className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-gray-500">No stops on this route</p>
                    </div>
                  )
                ) : routes.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <User className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-gray-500">Select a route to view stops</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <Calendar className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-gray-500">No routes for this date</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Select a different date or create a new route
                    </p>
                  </div>
                )}
              </div>

              {/* Footer with Route Stats */}
              {selectedRoute && selectedRoute.stops.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">
                        {selectedRoute.stops.reduce((sum, s) => sum + s.dogCount, 0)} total dogs
                      </span>
                      <span className="text-gray-500">
                        $
                        {selectedRoute.stops
                          .reduce(
                            (sum, s) => sum + (s.subscription?.pricePerVisitCents || 0),
                            0
                          ) / 100}
                        {" "}revenue
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </GoogleMapsProvider>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <RouteManagerContent />
    </Suspense>
  );
}
