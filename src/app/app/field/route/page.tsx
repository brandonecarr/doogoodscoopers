"use client";

import { useState, useEffect, useCallback } from "react";
import { StopCard } from "@/components/portals/field/StopCard";
import { RouteStaticMap } from "@/components/portals/field/RouteStaticMap";
import { ArrowLeft, MapPin, RefreshCw, CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";

interface Dog {
  id: string;
  name: string;
  breed: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
}

interface Stop {
  id: string;
  order: number;
  job: {
    id: string;
    status: string;
    client: {
      id: string;
      firstName: string | null;
      lastName: string | null;
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
    } | null;
    dogs: Dog[];
  } | null;
}

interface Route {
  id: string;
  name: string | null;
  date: string;
  status: string;
}

interface Stats {
  total: number;
  completed: number;
  skipped: number;
  remaining: number;
  inProgress: number;
  enRoute: number;
}

export default function RoutePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, skipped: 0, remaining: 0, inProgress: 0, enRoute: 0 });

  const fetchRoute = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const res = await fetch("/api/field/route");
      const data = await res.json();

      if (res.ok) {
        setRoute(data.route);
        setStops(data.stops || []);
        setStats(data.stats || { total: 0, completed: 0, skipped: 0, remaining: 0, inProgress: 0, enRoute: 0 });
      } else {
        setError(data.error || "Failed to load route");
      }
    } catch (err) {
      console.error("Error fetching route:", err);
      setError("Failed to load route");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Find the next stop (first non-completed, non-skipped)
  const nextStop = stops.find(
    (stop) => stop.job && !["COMPLETED", "SKIPPED"].includes(stop.job.status)
  );

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/app/field"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Today&apos;s Route</h1>
            {route && (
              <p className="text-sm text-gray-500">{route.name || "Route"}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchRoute(true)}
          disabled={refreshing}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4 text-gray-400" />
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <p className="text-xs text-gray-500">Done</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <p className="text-xl font-bold text-blue-600">{stats.remaining}</p>
            </div>
            <p className="text-xs text-gray-500">Left</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="w-4 h-4 text-orange-500" />
              <p className="text-xl font-bold text-orange-600">{stats.skipped}</p>
            </div>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
        </div>

        {/* Progress bar */}
        {stats.total > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {Math.round((stats.completed / stats.total) * 100)}% complete
            </p>
          </div>
        )}
      </div>

      {/* Route Map */}
      {route && stops.length > 0 && (
        <RouteStaticMap stops={stops} />
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* No route */}
      {!route && !error && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Route Assigned</h3>
          <p className="text-gray-500 text-sm">
            You don&apos;t have a route assigned for today. Check back later or contact your manager.
          </p>
        </div>
      )}

      {/* Stop list */}
      {route && stops.length > 0 && (
        <div className="space-y-3">
          {stops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              isNext={nextStop?.id === stop.id}
            />
          ))}
        </div>
      )}

      {/* No stops */}
      {route && stops.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stops Yet</h3>
          <p className="text-gray-500 text-sm">
            No stops have been added to this route yet.
          </p>
        </div>
      )}

      {/* All done message */}
      {route && stats.total > 0 && stats.completed === stats.total && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-800 mb-2">Route Complete!</h3>
          <p className="text-green-700">
            Great job! You&apos;ve completed all {stats.total} stops.
          </p>
        </div>
      )}
    </div>
  );
}
