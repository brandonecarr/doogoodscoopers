"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, MapPin, Calendar, Clock, Dog } from "lucide-react";
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

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-teal-500/10 text-teal-600 ring-teal-500/30";
      case "PAUSED":
        return "bg-yellow-500/10 text-yellow-600 ring-yellow-500/30";
      case "CANCELED":
        return "bg-red-500/10 text-red-500 ring-red-500/30";
      case "PAST_DUE":
        return "bg-orange-500/10 text-orange-600 ring-orange-500/30";
      default:
        return "bg-gray-500/10 text-gray-600 ring-gray-500/30";
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

      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Dog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No subscriptions found.</p>
          <Link
            href="/quote"
            className="inline-block mt-3 text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Request Service &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((sub) => {
            const totalPerVisit =
              sub.pricePerVisit +
              sub.addOns.reduce((sum, a) => sum + a.priceCents * a.quantity, 0);

            return (
              <div key={sub.id} className="group relative">
                {/* Card */}
                <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-teal-300">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-semibold text-gray-900">
                        {sub.plan?.name || "Standard Plan"}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${getStatusBadge(sub.status)}`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-5">
                      {formatFrequency(sub.frequency)} cleanup service
                    </p>

                    {/* Pricing */}
                    <div className="flex items-end gap-1.5 mb-5">
                      <span className="text-3xl font-semibold text-gray-900">
                        {formatCurrency(totalPerVisit)}
                      </span>
                      <span className="text-sm text-gray-400 mb-1">/visit</span>
                    </div>

                    {/* Divider */}
                    <hr className="mb-5 border-t border-gray-100" />

                    {/* Details list */}
                    <ul className="flex flex-col gap-3 mb-6">
                      <li className="flex items-center gap-3">
                        <span className="grid place-items-center w-5 h-5 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex-shrink-0">
                          <Check className="w-3 h-3 text-teal-600" strokeWidth={2.5} />
                        </span>
                        <span className="text-sm text-gray-700">
                          <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                          {formatFrequency(sub.frequency)}
                        </span>
                      </li>

                      {sub.preferredDay && (
                        <li className="flex items-center gap-3">
                          <span className="grid place-items-center w-5 h-5 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex-shrink-0">
                            <Check className="w-3 h-3 text-teal-600" strokeWidth={2.5} />
                          </span>
                          <span className="text-sm text-gray-700">
                            <Clock className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                            Preferred day: {sub.preferredDay}
                          </span>
                        </li>
                      )}

                      {sub.location && (
                        <li className="flex items-center gap-3">
                          <span className="grid place-items-center w-5 h-5 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex-shrink-0">
                            <Check className="w-3 h-3 text-teal-600" strokeWidth={2.5} />
                          </span>
                          <span className="text-sm text-gray-700">
                            <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                            {sub.location.addressLine1}, {sub.location.city}
                          </span>
                        </li>
                      )}

                      {sub.addOns.map((addon) => (
                        <li key={addon.id} className="flex items-center gap-3">
                          <span className="grid place-items-center w-5 h-5 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex-shrink-0">
                            <Check className="w-3 h-3 text-teal-600" strokeWidth={2.5} />
                          </span>
                          <span className="text-sm text-gray-700">
                            {addon.name}{" "}
                            <span className="text-gray-400">
                              (+{formatCurrency(addon.priceCents)})
                            </span>
                          </span>
                        </li>
                      ))}

                      {sub.addOns.length === 0 && (
                        <li className="flex items-center gap-3">
                          <span className="grid place-items-center w-5 h-5 rounded-full bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
                            <Check className="w-3 h-3 text-gray-400" strokeWidth={2.5} />
                          </span>
                          <span className="text-sm text-gray-400 italic">No add-ons</span>
                        </li>
                      )}
                    </ul>

                    {/* CTA Button */}
                    <Link
                      href={`/app/client/subscription/${sub.id}`}
                      className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 shadow-sm ring-1 ring-teal-600/20 hover:from-teal-400 hover:to-teal-500 hover:shadow-md transition-all duration-300"
                    >
                      View Details
                    </Link>

                    {/* Footer info */}
                    {sub.nextServiceDate && sub.status === "ACTIVE" && (
                      <p className="text-xs text-gray-500 bg-gray-50 text-center mt-4 px-3 py-2 rounded-lg ring-1 ring-gray-100">
                        Next service: {new Date(sub.nextServiceDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    )}

                    {sub.status === "PAUSED" && sub.pauseEndDate && (
                      <p className="text-xs text-yellow-600 bg-yellow-50 text-center mt-4 px-3 py-2 rounded-lg ring-1 ring-yellow-200">
                        Paused until {new Date(sub.pauseEndDate + "T00:00:00").toLocaleDateString()}
                      </p>
                    )}

                    {sub.status === "CANCELED" && (
                      <p className="text-xs text-red-500 bg-red-50 text-center mt-4 px-3 py-2 rounded-lg ring-1 ring-red-200">
                        Canceled on {new Date(sub.canceledAt || sub.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
