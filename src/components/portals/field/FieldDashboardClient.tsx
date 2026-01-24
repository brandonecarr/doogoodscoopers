"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Clock, CheckCircle, AlertTriangle, Play, Coffee, Navigation } from "lucide-react";
import Link from "next/link";
import { PhotoQueue } from "./PhotoQueue";
import { usePWA } from "./PWAProvider";

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface Shift {
  id: string;
  status: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  clockInTime: string;
}

interface NextStop {
  id: string;
  order: number;
  job: {
    id: string;
    status: string;
    client: {
      firstName: string | null;
      lastName: string | null;
    } | null;
    location: {
      addressLine1: string;
      city: string;
    } | null;
  } | null;
}

interface Stats {
  total: number;
  completed: number;
  remaining: number;
  skipped: number;
}

interface FieldDashboardClientProps {
  user: User;
}

export function FieldDashboardClient({ user }: FieldDashboardClientProps) {
  const { isOnline } = usePWA();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, remaining: 0, skipped: 0 });
  const [nextStop, setNextStop] = useState<NextStop | null>(null);
  const [elapsedTime, setElapsedTime] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // Fetch shift and route data in parallel
      const [shiftRes, routeRes] = await Promise.all([
        fetch("/api/field/shift"),
        fetch("/api/field/route"),
      ]);

      const shiftData = await shiftRes.json();
      const routeData = await routeRes.json();

      if (shiftRes.ok && shiftData.shift) {
        setShift(shiftData.shift);
      }

      if (routeRes.ok) {
        setStats(routeData.stats || { total: 0, completed: 0, remaining: 0, skipped: 0 });

        // Find next stop
        const stops = routeData.stops || [];
        const next = stops.find(
          (s: NextStop) => s.job && !["COMPLETED", "SKIPPED"].includes(s.job.status)
        );
        setNextStop(next || null);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update elapsed time
  useEffect(() => {
    if (!shift || shift.status === "CLOCKED_OUT") return;

    const updateTime = () => {
      const clockIn = new Date(shift.clockInTime);
      const now = new Date();
      const diffMs = now.getTime() - clockIn.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedTime(`${hours}h ${minutes}m`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [shift]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const isClockedIn = shift && shift.status !== "CLOCKED_OUT";
  const isOnBreak = shift?.status === "ON_BREAK";

  return (
    <div className="space-y-4">
      {/* Photo queue indicator */}
      <PhotoQueue />

      {/* Status Card */}
      <div className={`rounded-xl shadow-sm p-4 ${
        isOnBreak
          ? "bg-orange-50 border-2 border-orange-200"
          : isClockedIn
          ? "bg-green-50 border-2 border-green-200"
          : "bg-white"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {getGreeting()}, {user.firstName || "there"}!
            </h2>
            <p className={`text-sm ${
              isOnBreak
                ? "text-orange-600"
                : isClockedIn
                ? "text-green-600"
                : "text-gray-500"
            }`}>
              {isOnBreak
                ? "On break"
                : isClockedIn
                ? `Clocked in • ${elapsedTime}`
                : "Ready to start your day?"}
            </p>
          </div>
          {!isClockedIn ? (
            <Link
              href="/app/field/shift"
              className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Clock In
            </Link>
          ) : isOnBreak ? (
            <div className="flex items-center gap-2 text-orange-600">
              <Coffee className="w-5 h-5" />
              <span className="text-sm font-medium">Break</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">Active</span>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-gray-500">Done</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.remaining}</p>
            <p className="text-xs text-gray-500">Left</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.skipped}</p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
        </div>
      </div>

      {/* Next Stop Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Next Stop</h3>

        {nextStop && nextStop.job ? (
          <Link
            href={`/app/field/route/${nextStop.id}`}
            className="block bg-teal-50 rounded-lg p-4 border-2 border-teal-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{nextStop.order}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">
                  {nextStop.job.client
                    ? `${nextStop.job.client.firstName || ""} ${nextStop.job.client.lastName || ""}`.trim()
                    : "Unknown Client"}
                </h4>
                {nextStop.job.location && (
                  <p className="text-sm text-gray-600 truncate flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {nextStop.job.location.addressLine1}, {nextStop.job.location.city}
                  </p>
                )}
              </div>
              <Navigation className="w-5 h-5 text-teal-600 flex-shrink-0" />
            </div>
          </Link>
        ) : stats.total > 0 && stats.completed === stats.total ? (
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">All done for today!</p>
            <p className="text-green-600 text-sm mt-1">
              You completed {stats.total} stops
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No stops assigned yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Your route will appear once jobs are scheduled
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/app/field/route"
          className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">View Route</p>
            <p className="text-xs text-gray-500">See all stops</p>
          </div>
        </Link>

        <Link
          href="/app/field/history"
          className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">History</p>
            <p className="text-xs text-gray-500">Past jobs</p>
          </div>
        </Link>
      </div>

      {/* Shift Management Link */}
      {isClockedIn && (
        <Link
          href="/app/field/shift"
          className="block bg-white rounded-xl shadow-sm p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Manage Shift</p>
                <p className="text-xs text-gray-500">Break, clock out</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{elapsedTime}</p>
              <p className="text-xs text-gray-500">elapsed</p>
            </div>
          </div>
        </Link>
      )}

      {/* Offline Notice */}
      {!isOnline && (
        <div className="bg-yellow-50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">You&apos;re Offline</p>
            <p className="text-xs text-yellow-700 mt-1">
              Some features may be limited. Data will sync when you&apos;re back online.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
