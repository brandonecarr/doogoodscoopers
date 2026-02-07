"use client";

import { useState, useEffect } from "react";
import { Eye, Loader2 } from "lucide-react";
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

export default function SubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        const res = await fetch("/api/client/subscription");
        const data = await res.json();

        if (res.ok) {
          setSubscriptions(data.subscriptions || []);
        } else {
          setError(data.error || "Failed to load subscriptions");
        }
      } catch (err) {
        console.error("Error fetching subscriptions:", err);
        setError("Failed to load subscriptions");
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptions();
  }, []);

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

  const formatDate = (dateStr: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No subscriptions found.</p>
            <Link
              href="/quote"
              className="inline-block mt-3 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Request Service &rarr;
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Frequency</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Start Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Add-ons</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 bg-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`font-medium ${getStatusStyle(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {sub.plan?.name || "Standard"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatFrequency(sub.frequency)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {formatCurrency(sub.pricePerVisit)}/visit
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {sub.addOns.length > 0
                        ? sub.addOns.map((a) => a.name).join(", ")
                        : <span className="text-gray-400 italic">None</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center bg-gray-50">
                      <Link
                        href={`/app/client/subscription/${sub.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-teal-600 hover:bg-teal-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
