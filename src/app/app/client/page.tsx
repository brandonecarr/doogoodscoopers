"use client";

import { useEffect, useState } from "react";
import {
  Dog,
  Loader2,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
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
    overdueBalance: number;
  };
  referrals: {
    total: number;
    converted: number;
    pending: number;
  };
  stats: {
    recentJobsCount: number;
  };
  organization: {
    name: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      zipCode: string;
    } | null;
    phone: string | null;
    canText: boolean;
    canCall: boolean;
    email: string | null;
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

  const org = data.organization;
  const hasAddress = org.address && (org.address.line1 || org.address.city);
  const hasContactInfo = org.phone || org.email || hasAddress;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome {data.client.firstName} {data.client.lastName}
            </h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Client portal allows you to manage your contact info as well as details about your location, yard, dogs, schedule, billing and notification preferences. You may also add multiple credit cards or request subscription changes.
            </p>
          </div>
          <div className="flex gap-0 flex-shrink-0">
            <div className="border-l-2 border-green-500 pl-3 pr-5">
              <p className="text-xs text-gray-500">Open Balance</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.balance.openBalance)}
              </p>
            </div>
            <div className="border-l-2 border-red-400 pl-3">
              <p className="text-xs text-gray-500">Overdue</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.balance.overdueBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Request Service CTA (only if no active subscription) */}
      {!data.subscription && (
        <div className="bg-white rounded-lg border border-gray-200 py-10 px-6 text-center">
          <div className="flex justify-center mb-4">
            <Dog className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Request Service</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
            You&apos;re just a few clicks away from a beautiful, waste-free yard!
          </p>
          <p className="text-gray-500 text-sm">
            Please provide any missing info to get a free quote and request service!
          </p>
          <Link
            href="/quote"
            className="inline-block mt-4 bg-green-500 text-white px-6 py-2.5 rounded font-medium text-sm uppercase tracking-wide hover:bg-green-600 transition-colors"
          >
            Request Service
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <Link href="/app/client/subscription" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Subscriptions &rarr;
          </Link>
          <Link href="/app/client/schedule" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Cleanups &rarr;
          </Link>
          <Link href="/app/client/billing" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Invoices &rarr;
          </Link>
          <Link href="/app/client/dogs" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Dog Info &rarr;
          </Link>
          <Link href="/app/client/billing" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Payment Methods &rarr;
          </Link>
          <Link href="/app/client/settings" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Notification Settings &rarr;
          </Link>
          <Link href="/app/client/referrals" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Refer a Friend &rarr;
          </Link>
        </div>
      </div>

      {/* Business Info Footer */}
      {hasContactInfo && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{org.name} info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hasAddress && org.address && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Address</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {org.address.line1}
                  {org.address.line2 && <><br />{org.address.line2}</>}
                  {(org.address.city || org.address.state) && (
                    <><br />{[org.address.city, org.address.state].filter(Boolean).join(", ")} {org.address.zipCode}</>
                  )}
                </p>
              </div>
            )}

            {org.phone && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-5 h-5 text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Phone Number</h3>
                </div>
                <p className="text-sm text-gray-500">{org.phone}</p>
                <div className="flex items-center gap-4 mt-3">
                  {org.canCall && (
                    <a
                      href={`tel:${org.phone}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call Us
                    </a>
                  )}
                  {org.canText && (
                    <a
                      href={`sms:${org.phone}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Text Us
                    </a>
                  )}
                </div>
              </div>
            )}

            {org.email && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Email Address</h3>
                </div>
                <a
                  href={`mailto:${org.email}`}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  {org.email}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
