"use client";

import { useState, useEffect } from "react";
import { MapPin, RefreshCw, AlertCircle, ChevronRight } from "lucide-react";
import { AssignmentModal } from "@/components/assignments/AssignmentModal";

interface UnassignedSubscription {
  id: string;
  clientId: string;
  clientName: string;
  locationId: string;
  address: string;
  city: string;
  zipCode: string;
  planName: string | null;
  frequency: string;
  signUpDate: string;
  hasPaymentMethod: boolean;
  needsInitialCleanup: boolean;
  needsRouteAssignment: boolean;
}

function formatFrequency(freq: string) {
  const labels: Record<string, string> = {
    TWICE_WEEKLY: "Twice Weekly",
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    ONETIME: "One-time",
  };
  return labels[freq] || freq;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UnassignedLocationsPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<UnassignedSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<UnassignedSubscription | null>(null);

  useEffect(() => {
    fetchUnassigned();
  }, []);

  async function fetchUnassigned() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/unassigned-subscriptions");
      const data = await res.json();

      if (res.ok) {
        setSubscriptions(data.subscriptions || []);
        setTotal(data.total || 0);
      } else {
        setError(data.error || "Failed to load unassigned subscriptions");
      }
    } catch (err) {
      console.error("Error fetching unassigned subscriptions:", err);
      setError("Failed to load unassigned subscriptions");
    } finally {
      setLoading(false);
    }
  }

  function handleAssignmentSaved() {
    fetchUnassigned();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unassigned Locations</h1>
          <p className="text-gray-600">
            {total} subscription{total !== 1 ? "s" : ""} needing tech & route assignment
          </p>
        </div>
        <button
          onClick={fetchUnassigned}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No subscriptions need assignment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Location ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Address
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    City
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Zip
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Sign Up
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-gray-600">
                        {sub.locationId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{sub.clientName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {sub.needsInitialCleanup && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                              Initial
                            </span>
                          )}
                          {sub.needsRouteAssignment && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              Route
                            </span>
                          )}
                          {!sub.hasPaymentMethod && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                              No card
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 truncate max-w-[200px] block">
                        {sub.address}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{sub.city}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{sub.zipCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">
                        {sub.planName || formatFrequency(sub.frequency)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {formatDate(sub.signUpDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedSubscription(sub)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
                      >
                        Assign
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedSubscription && (
        <AssignmentModal
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
          onSave={handleAssignmentSaved}
        />
      )}
    </div>
  );
}
