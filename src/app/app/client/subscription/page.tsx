"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Subscription {
  id: string;
  status: string;
  frequency: string;
  pricePerVisit: number;
  preferredDay: string | null;
  nextServiceDate: string | null;
  pausedUntil: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  plan: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    city: string;
  } | null;
  addOns: Array<{
    id: string;
    name: string;
    priceCents: number;
  }>;
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [pauseUntil, setPauseUntil] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [newFrequency, setNewFrequency] = useState("");

  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch("/api/client/subscription");
        const data = await res.json();

        if (res.ok) {
          setSubscription(data.subscription);
        } else {
          setError(data.error || "Failed to load subscription");
        }
      } catch (err) {
        console.error("Error fetching subscription:", err);
        setError("Failed to load subscription");
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, []);

  const handleAction = async (action: string, data: Record<string, unknown> = {}) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await res.json();

      if (res.ok) {
        setSuccess(result.message);
        // Refresh subscription data
        const refreshRes = await fetch("/api/client/subscription");
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setSubscription(refreshData.subscription);
        }
        setShowPauseModal(false);
        setShowCancelModal(false);
      } else {
        setError(result.error || "Action failed");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case "WEEKLY":
        return "Weekly";
      case "BIWEEKLY":
        return "Every 2 Weeks";
      case "MONTHLY":
        return "Monthly";
      case "ONETIME":
        return "One-Time";
      default:
        return freq;
    }
  };

  const getMinPauseDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const getMaxPauseDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3); // Max 3 months pause
    return maxDate.toISOString().split("T")[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/client/profile"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Subscription</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
          <p className="text-gray-500 text-sm">
            You don&apos;t have an active subscription. Contact us to get started!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/client/profile"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Manage Subscription</h1>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Subscription Details */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Subscription Details</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              subscription.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : subscription.status === "PAUSED"
                ? "bg-yellow-100 text-yellow-700"
                : subscription.status === "PENDING_CANCEL"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {subscription.status === "PENDING_CANCEL" ? "Canceling" : subscription.status}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan</span>
            <span className="font-medium">{subscription.plan?.name || "Standard"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Frequency</span>
            <span className="font-medium">{formatFrequency(subscription.frequency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price per Visit</span>
            <span className="font-medium">${(subscription.pricePerVisit / 100).toFixed(2)}</span>
          </div>
          {subscription.preferredDay && (
            <div className="flex justify-between">
              <span className="text-gray-600">Preferred Day</span>
              <span className="font-medium">{subscription.preferredDay}</span>
            </div>
          )}
          {subscription.location && (
            <div className="flex justify-between">
              <span className="text-gray-600">Location</span>
              <span className="font-medium text-right">
                {subscription.location.addressLine1}, {subscription.location.city}
              </span>
            </div>
          )}
          {subscription.nextServiceDate && subscription.status === "ACTIVE" && (
            <div className="flex justify-between">
              <span className="text-gray-600">Next Service</span>
              <span className="font-medium">
                {new Date(subscription.nextServiceDate + "T00:00:00").toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {subscription.pausedUntil && (
          <div className="mx-4 mb-4 bg-yellow-50 rounded-lg p-3">
            <p className="text-sm text-yellow-700">
              <strong>Paused</strong> until {new Date(subscription.pausedUntil).toLocaleDateString()}
            </p>
          </div>
        )}
        {subscription.cancelAtPeriodEnd && (
          <div className="mx-4 mb-4 bg-red-50 rounded-lg p-3">
            <p className="text-sm text-red-700">
              <strong>Cancellation pending.</strong> Service will end after your current period.
            </p>
          </div>
        )}
      </div>

      {/* Add-ons */}
      {subscription.addOns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Add-ons</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {subscription.addOns.map((addon) => (
              <div key={addon.id} className="p-4 flex justify-between">
                <span className="text-gray-700">{addon.name}</span>
                <span className="font-medium">${(addon.priceCents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {subscription.status === "ACTIVE" && (
        <div className="space-y-3">
          {subscription.frequency !== "ONETIME" && (
            <button
              onClick={() => {
                setNewFrequency(subscription.frequency);
                setShowFrequencyModal(true);
              }}
              className="w-full bg-teal-100 text-teal-800 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-teal-200 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Change Frequency
            </button>
          )}
          <button
            onClick={() => setShowPauseModal(true)}
            className="w-full bg-yellow-100 text-yellow-800 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-yellow-200 transition-colors"
          >
            <Pause className="w-5 h-5" />
            Pause Subscription
          </button>
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full bg-white border border-red-300 text-red-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            Cancel Subscription
          </button>
        </div>
      )}

      {subscription.status === "PAUSED" && (
        <button
          onClick={() => handleAction("resume")}
          disabled={actionLoading}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          Resume Subscription
        </button>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pause Subscription</h3>
            <p className="text-gray-600 mb-4">
              Your service will be paused until the date you select. You can resume anytime.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pause Until
              </label>
              <input
                type="date"
                value={pauseUntil}
                onChange={(e) => setPauseUntil(e.target.value)}
                min={getMinPauseDate()}
                max={getMaxPauseDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction("pause", { pauseUntil })}
                disabled={actionLoading || !pauseUntil}
                className="flex-1 bg-yellow-500 text-white py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Pause"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h3 className="text-lg font-bold text-gray-900">Cancel Subscription</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure? Your service will continue until the end of your current billing period.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for canceling (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="We'd love to know how we can improve..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => handleAction("cancel", { reason: cancelReason })}
                disabled={actionLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frequency Change Modal */}
      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-8 h-8 text-teal-500" />
              <h3 className="text-lg font-bold text-gray-900">Change Service Frequency</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Select how often you&apos;d like us to service your yard. Changes take effect on your next billing cycle.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { value: "WEEKLY", label: "Weekly", desc: "Best for multiple dogs or heavy use" },
                { value: "BIWEEKLY", label: "Every 2 Weeks", desc: "Most popular option" },
                { value: "MONTHLY", label: "Monthly", desc: "Light maintenance" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    newFrequency === option.value
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option.value}
                    checked={newFrequency === option.value}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFrequencyModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction("changeFrequency", { frequency: newFrequency });
                  setShowFrequencyModal(false);
                }}
                disabled={actionLoading || newFrequency === subscription.frequency}
                className="flex-1 bg-teal-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Update Frequency"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
