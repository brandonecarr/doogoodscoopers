import { requireFieldAccess } from "@/lib/auth-supabase";
import { MapPin, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function FieldDashboard() {
  const user = await requireFieldAccess();

  // Placeholder data - will be replaced with real queries
  const todayStats = {
    totalStops: 0,
    completed: 0,
    remaining: 0,
    skipped: 0,
  };

  const isClockingIn = false; // TODO: Check shift status

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Good morning, {user.firstName || "there"}!
            </h2>
            <p className="text-sm text-gray-500">
              {isClockingIn ? "You're clocked in" : "Ready to start your day?"}
            </p>
          </div>
          {!isClockingIn ? (
            <Link
              href="/app/field/shift"
              className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              Clock In
            </Link>
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
            <p className="text-2xl font-bold text-gray-900">{todayStats.totalStops}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{todayStats.completed}</p>
            <p className="text-xs text-gray-500">Done</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{todayStats.remaining}</p>
            <p className="text-xs text-gray-500">Left</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{todayStats.skipped}</p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
        </div>
      </div>

      {/* Next Stop Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Next Stop</h3>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No stops assigned yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Your route will appear once jobs are scheduled
          </p>
        </div>
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

      {/* Setup Notice */}
      <div className="bg-yellow-50 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">System Setup</p>
          <p className="text-xs text-yellow-700 mt-1">
            The scheduling system is being set up. Your routes will appear here once configured.
          </p>
        </div>
      </div>
    </div>
  );
}
