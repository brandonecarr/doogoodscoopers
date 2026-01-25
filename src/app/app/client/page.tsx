"use client";

import { useEffect, useState } from "react";
import { Calendar, CreditCard, Share2, Dog, CheckCircle, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    referralCode: string;
  };
  nextService: {
    id: string;
    date: string;
    status: string;
    address: string;
    city: string;
  } | null;
  subscription: {
    id: string;
    status: string;
    frequency: string;
    pricePerVisit: number;
    nextServiceDate: string | null;
    planName: string;
  } | null;
  balance: {
    accountCredit: number;
    openBalance: number;
  };
  referrals: {
    total: number;
    converted: number;
    pending: number;
  };
  stats: {
    recentJobsCount: number;
  };
}

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/client/dashboard");
        const result = await res.json();

        if (res.ok) {
          setData(result);
        } else {
          setError(result.error || "Failed to load dashboard");
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          Hi, {data.client.firstName || "there"}!
        </h1>
        <p className="text-teal-100 text-sm">
          Welcome to your DooGoodScoopers account
        </p>
      </div>

      {/* Next Service */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          Next Service
        </h2>

        {data.nextService ? (
          <div className="bg-teal-50 rounded-lg p-4">
            <p className="font-medium text-teal-900">{formatDate(data.nextService.date)}</p>
            <div className="flex items-center gap-1 text-sm text-teal-700 mt-1">
              <MapPin className="w-4 h-4" />
              {data.nextService.address}, {data.nextService.city}
            </div>
            {data.nextService.status !== "SCHEDULED" && (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {data.nextService.status === "EN_ROUTE" ? "On The Way!" : data.nextService.status}
              </span>
            )}
          </div>
        ) : data.subscription ? (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No upcoming service scheduled</p>
            <p className="text-gray-400 text-xs mt-1">
              Your next service will appear here
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Dog className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No active subscription</p>
            <Link href="/quote" className="text-teal-600 text-sm font-medium mt-2 inline-block">
              Get a Quote →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Balance</span>
          </div>
          <p className={`text-2xl font-bold ${data.balance.openBalance > 0 ? "text-red-600" : "text-gray-900"}`}>
            {formatCurrency(data.balance.openBalance)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Share2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Credit</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(data.balance.accountCredit)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        <Link
          href="/app/client/schedule"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Schedule</p>
              <p className="text-sm text-gray-500">
                {data.stats.recentJobsCount > 0
                  ? `${data.stats.recentJobsCount} services in last 30 days`
                  : "See upcoming services"}
              </p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        <Link
          href="/app/client/billing"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Billing & Payments</p>
              <p className="text-sm text-gray-500">Manage payment methods</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        <Link
          href="/app/client/referrals"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Share2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Refer a Friend</p>
              <p className="text-sm text-gray-500">
                {data.referrals.converted > 0
                  ? `${data.referrals.converted} successful referrals`
                  : "Earn $25 per referral"}
              </p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        <Link
          href="/app/client/profile"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Dog className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">My Profile</p>
              <p className="text-sm text-gray-500">Account & pet info</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>
      </div>

      {/* Subscription Status */}
      {data.subscription && (
        <div className="bg-green-50 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {data.subscription.planName} - {data.subscription.frequency.charAt(0) + data.subscription.frequency.slice(1).toLowerCase()}
            </p>
            <p className="text-xs text-green-700 mt-1">
              {formatCurrency(data.subscription.pricePerVisit)} per visit
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
