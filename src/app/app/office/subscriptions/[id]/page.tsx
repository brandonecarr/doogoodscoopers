"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Info,
  MoreVertical,
  PlusCircle,
  XCircle,
  PauseCircle,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";

interface SubscriptionDetails {
  id: string;
  status: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  planName: string | null;
  dateCreated: string;
  startDate: string;
  endDate: string | null;
  amountCents: number;
  frequency: string;
  tip: number | null;
  couponCode: string | null;
  couponAddedAt: string | null;
  couponExpiredAt: string | null;
  billingOption: string;
  billingInterval: string;
  startOfBillingPeriod: string;
  endOfBillingPeriod: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "No data";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "No data";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    WEEKLY: "weekly",
    TWICE_WEEKLY: "twice weekly",
    BIWEEKLY: "bi-weekly",
    MONTHLY: "monthly",
    ONETIME: "one-time",
  };
  return labels[frequency] || frequency.toLowerCase();
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "text-teal-600 bg-teal-50";
    case "PENDING":
      return "text-amber-600 bg-amber-50";
    case "PAUSED":
      return "text-yellow-600 bg-yellow-50";
    case "CANCELED":
      return "text-gray-600 bg-gray-100";
    case "PAST_DUE":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

export default function SubscriptionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const subscriptionId = params.id as string;

  // Close actions menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch subscription details
  useEffect(() => {
    fetchSubscriptionDetails();
  }, [subscriptionId]);

  async function fetchSubscriptionDetails() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/subscriptions");
      if (response.ok) {
        const data = await response.json();
        const sub = (data.subscriptions || []).find(
          (s: any) => s.id === subscriptionId
        );

        if (sub) {
          // Calculate billing period dates
          const now = new Date();
          const startOfBilling = new Date(sub.created_at);
          const endOfBilling = new Date(now.getFullYear(), now.getMonth() + 1, 1);

          setSubscription({
            id: sub.id,
            status: sub.status || "ACTIVE",
            clientId: sub.client_id,
            clientName: sub.client
              ? `${sub.client.first_name} ${sub.client.last_name || ""}`.trim()
              : "Unknown",
            clientEmail: sub.client?.email || "No email",
            planName: sub.plan?.name || null,
            dateCreated: sub.created_at,
            startDate: sub.created_at,
            endDate: sub.canceled_at || null,
            amountCents: sub.price_per_visit_cents || 0,
            frequency: sub.frequency || "MONTHLY",
            tip: null,
            couponCode: sub.coupon_code || null,
            couponAddedAt: sub.coupon_applied_at || null,
            couponExpiredAt: sub.coupon_expires_at || null,
            billingOption: "Prepaid Fixed",
            billingInterval: "Monthly",
            startOfBillingPeriod: startOfBilling.toISOString(),
            endOfBillingPeriod: endOfBilling.toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Loading subscription details...
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Subscription not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-teal-600 hover:text-teal-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              Subscription ID: {subscription.id.slice(0, 6)}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-sm font-medium ${getStatusColor(
                subscription.status
              )}`}
            >
              {subscription.status}
            </span>
          </div>
          <p className="text-gray-600">
            {subscription.clientName} on {subscription.planName || "Unknown Plan"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              ACTIONS
              <ChevronDown className="w-4 h-4" />
            </button>
            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <PlusCircle className="w-4 h-4 text-teal-500" />
                  Add Coupon
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Remove Coupon
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <PlusCircle className="w-4 h-4 text-teal-500" />
                  Add Recurring Tip
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Cancel Subscription
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <PauseCircle className="w-4 h-4 text-amber-500" />
                  Pause Subscription
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <ArrowRightLeft className="w-4 h-4 text-teal-500" />
                  Change Cleanup Frequency
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <ArrowRightLeft className="w-4 h-4 text-red-500" />
                  Change Billing Option
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <ArrowRightLeft className="w-4 h-4 text-teal-500" />
                  Change Billing Interval
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <ArrowRightLeft className="w-4 h-4 text-teal-500" />
                  Change Price
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">Details</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Client */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Client</div>
            <div className="w-2/3 flex items-center gap-2">
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-4 h-4" />
              </button>
              <Link
                href={`/app/office/clients/${subscription.clientId}`}
                className="text-gray-900 hover:text-teal-600"
              >
                {subscription.clientName}
              </Link>
            </div>
          </div>

          {/* Client Email */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Client Email</div>
            <div className="w-2/3 text-gray-900">{subscription.clientEmail}</div>
          </div>

          {/* Subscription ID */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Subscription ID</div>
            <div className="w-2/3 text-gray-900">{subscription.id.slice(0, 6)}</div>
          </div>

          {/* Subscription Name */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Subscription Name</div>
            <div className="w-2/3 text-gray-900">
              {subscription.planName || "No data"}
            </div>
          </div>

          {/* Date created */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Date created</div>
            <div className="w-2/3 text-gray-900">
              {formatDate(subscription.dateCreated)}
            </div>
          </div>

          {/* Start Date */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Start Date</div>
            <div className="w-2/3 text-gray-900">
              {formatDate(subscription.startDate)}
            </div>
          </div>

          {/* End Date */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">End Date</div>
            <div className="w-2/3 text-gray-500 italic">
              {subscription.endDate ? formatDate(subscription.endDate) : "No data"}
            </div>
          </div>

          {/* Amount */}
          <div className="flex px-6 py-4 bg-gray-50">
            <div className="w-1/3 text-gray-600">Amount</div>
            <div className="w-2/3 text-gray-900">
              {formatCurrency(subscription.amountCents)}{" "}
              <span className="text-gray-500 text-sm">
                {getFrequencyLabel(subscription.frequency)}
              </span>
            </div>
          </div>

          {/* Tip */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Tip</div>
            <div className="w-2/3 text-gray-500 italic">
              {subscription.tip ? formatCurrency(subscription.tip) : "No data"}
            </div>
          </div>

          {/* Coupon */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Coupon</div>
            <div className="w-2/3">
              {subscription.couponCode ? (
                <div className="flex items-start gap-2">
                  <button className="text-gray-400 hover:text-gray-600 mt-0.5">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="text-gray-900 font-medium">
                      {subscription.couponCode}
                    </div>
                    {subscription.couponAddedAt && (
                      <div className="text-teal-600 text-sm">
                        Added {formatDateTime(subscription.couponAddedAt)}
                      </div>
                    )}
                    {subscription.couponExpiredAt && (
                      <div className="text-red-500 text-sm">
                        Expired {formatDateTime(subscription.couponExpiredAt)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-gray-500 italic">No coupon</span>
              )}
            </div>
          </div>

          {/* Billing Option */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Billing Option</div>
            <div className="w-2/3 text-gray-900">{subscription.billingOption}</div>
          </div>

          {/* Billing Interval */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Billing Interval</div>
            <div className="w-2/3 text-gray-900">{subscription.billingInterval}</div>
          </div>

          {/* Start of Billing Period */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Start of Billing Period</div>
            <div className="w-2/3 text-gray-900">
              {formatDate(subscription.startOfBillingPeriod)}
            </div>
          </div>

          {/* End of Billing Period */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">End of Billing Period</div>
            <div className="w-2/3 flex items-center gap-2 text-gray-900">
              <Info className="w-4 h-4 text-teal-500" />
              {formatDate(subscription.endOfBillingPeriod)}
            </div>
          </div>

          {/* Status */}
          <div className="flex px-6 py-4">
            <div className="w-1/3 text-gray-600">Status</div>
            <div className="w-2/3">
              <span className={getStatusColor(subscription.status).split(" ")[0]}>
                {subscription.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
