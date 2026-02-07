"use client";

import { useState, useEffect, use } from "react";
import {
  ArrowLeft,
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
  pauseStartDate: string | null;
  pauseEndDate: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  plan: { id: string; name: string } | null;
  location: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;
  addOns: Array<{
    id: string;
    name: string;
    priceCents: number;
    quantity: number;
  }>;
}

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
          const found = (data.subscriptions || []).find(
            (s: Subscription) => s.id === id
          );
          setSubscription(found || null);
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
  }, [id]);

  const handleAction = async (action: string, data: Record<string, unknown> = {}) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subscriptionId: id, ...data }),
      });

      const result = await res.json();

      if (res.ok) {
        setSuccess(result.message);
        // Refresh
        const refreshRes = await fetch("/api/client/subscription");
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          const found = (refreshData.subscriptions || []).find(
            (s: Subscription) => s.id === id
          );
          setSubscription(found || null);
        }
        setShowPauseModal(false);
        setShowCancelModal(false);
        setShowFrequencyModal(false);
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
    const labels: Record<string, string> = {
      WEEKLY: "Once A Week",
      TWICE_WEEKLY: "Twice A Week",
      BIWEEKLY: "Every 2 Weeks",
      EVERY_THREE_WEEKS: "Every 3 Weeks",
      EVERY_FOUR_WEEKS: "Every 4 Weeks",
      MONTHLY: "Monthly",
      ONETIME: "One-Time",
    };
    return labels[freq] || freq;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return dateStr.split("T")[0];
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "text-green-600";
      case "PAUSED":
        return "text-yellow-600";
      case "CANCELED":
        return "text-red-500";
      case "PAST_DUE":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getMinPauseDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const getMaxPauseDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split("T")[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/client/subscription"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Subscription not found.</p>
        </div>
      </div>
    );
  }

  const totalPerVisit =
    subscription.pricePerVisit +
    subscription.addOns.reduce((sum, a) => sum + a.priceCents * a.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {subscription.plan?.name || "Subscription"}{" "}
            <span className={`text-base font-medium ${getStatusStyle(subscription.status)}`}>
              {subscription.status}
            </span>
          </h1>
        </div>
        <Link
          href="/app/client/subscription"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </Link>
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

      {/* Details Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-medium text-gray-700">Details</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <DetailRow label="Subscription Name" value={subscription.plan?.name || "Standard"} />
          <DetailRow label="Start Date" value={formatDate(subscription.createdAt)} bold />
          {subscription.canceledAt && (
            <DetailRow label="Cancel Date" value={formatDate(subscription.canceledAt)} bold />
          )}
          {subscription.pauseStartDate && (
            <DetailRow label="Pause Start" value={formatDate(subscription.pauseStartDate)} bold />
          )}
          {subscription.pauseEndDate && (
            <DetailRow label="Pause Until" value={formatDate(subscription.pauseEndDate)} bold />
          )}
          <DetailRow label="Cleanup Frequency" value={formatFrequency(subscription.frequency)} bold />
          {subscription.preferredDay && (
            <DetailRow label="Preferred Day" value={subscription.preferredDay} bold />
          )}
          <DetailRow label="Amount" value={`${formatCurrency(subscription.pricePerVisit)} per visit`} bold />
          {subscription.addOns.length > 0 && (
            <DetailRow
              label="Add-ons"
              value={subscription.addOns.map((a) => `${a.name} (${formatCurrency(a.priceCents)})`).join(", ")}
              bold
            />
          )}
          {subscription.addOns.length > 0 && (
            <DetailRow label="Total per Visit" value={formatCurrency(totalPerVisit)} bold />
          )}
          {subscription.nextServiceDate && subscription.status === "ACTIVE" && (
            <DetailRow label="Next Service" value={formatDate(subscription.nextServiceDate)} bold />
          )}
          {subscription.location && (
            <DetailRow
              label="Service Location"
              value={`${subscription.location.addressLine1}, ${subscription.location.city}, ${subscription.location.state} ${subscription.location.zipCode}`}
              bold
            />
          )}
          {subscription.cancelReason && (
            <DetailRow label="Cancel Reason" value={subscription.cancelReason} />
          )}
          <DetailRow
            label="Status"
            value={subscription.status}
            valueClassName={getStatusStyle(subscription.status)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      {subscription.status === "ACTIVE" && (
        <div className="flex flex-wrap gap-3">
          {subscription.frequency !== "ONETIME" && (
            <button
              onClick={() => {
                setNewFrequency(subscription.frequency);
                setShowFrequencyModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Change Frequency
            </button>
          )}
          <button
            onClick={() => setShowPauseModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause Subscription
          </button>
          <button
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancel Subscription
          </button>
        </div>
      )}

      {subscription.status === "PAUSED" && (
        <button
          onClick={() => handleAction("resume")}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Resume Subscription
        </button>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pause Subscription</h3>
            <p className="text-gray-600 text-sm mb-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction("pause", { pauseUntil })}
                disabled={actionLoading || !pauseUntil}
                className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pause"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">Cancel Subscription</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to cancel your subscription?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for canceling (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                placeholder="We'd love to know how we can improve..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => handleAction("cancel", { reason: cancelReason })}
                disabled={actionLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frequency Change Modal */}
      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-teal-500" />
              <h3 className="text-lg font-semibold text-gray-900">Change Service Frequency</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
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
                    <p className="font-medium text-gray-900 text-sm">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFrequencyModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction("changeFrequency", { frequency: newFrequency });
                }}
                disabled={actionLoading || newFrequency === subscription.frequency}
                className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Frequency"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  bold,
  valueClassName,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex px-5 py-3">
      <span className="w-48 flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${valueClassName || (bold ? "font-semibold text-gray-900" : "text-gray-700")}`}>
        {value}
      </span>
    </div>
  );
}
