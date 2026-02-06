"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CreditCard,
  Dog,
  ArrowRight,
  Loader2,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Bell,
  Heart,
  RefreshCw,
  FileText,
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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {data.client.firstName} {data.client.lastName}
            </h1>
            <p className="text-gray-500 mt-1">
              Here&apos;s an overview of your account
            </p>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <div className="text-left sm:text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Open Balance</p>
              <p className={`text-xl font-bold ${data.balance.openBalance > 0 ? "text-gray-900" : "text-gray-400"}`}>
                {formatCurrency(data.balance.openBalance)}
              </p>
            </div>
            {data.balance.overdueBalance > 0 && (
              <div className="text-left sm:text-right">
                <p className="text-xs text-red-500 uppercase tracking-wide">Overdue</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(data.balance.overdueBalance)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Service CTA (only if no active subscription) */}
      {!data.subscription && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Dog className="w-7 h-7 text-teal-600" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold text-teal-900">Request Service</h2>
            <p className="text-sm text-teal-700 mt-1">
              Ready to get started? Get a quote for pet waste removal service.
            </p>
          </div>
          <Link
            href="/quote"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors flex-shrink-0"
          >
            Get a Quote
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLinkCard
          href="/app/client/subscription"
          icon={<RefreshCw className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-100"
          title="Subscriptions"
          description="Manage your service plan"
        />
        <QuickLinkCard
          href="/app/client/schedule"
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
          title="Cleanups"
          description={
            data.stats.recentJobsCount > 0
              ? `${data.stats.recentJobsCount} services in last 30 days`
              : "View upcoming services"
          }
        />
        <QuickLinkCard
          href="/app/client/billing"
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-100"
          title="Invoices"
          description="View and pay invoices"
        />
        <QuickLinkCard
          href="/app/client/dogs"
          icon={<Dog className="w-5 h-5 text-purple-600" />}
          iconBg="bg-purple-100"
          title="Dog Info"
          description="Manage your pets"
        />
        <QuickLinkCard
          href="/app/client/billing"
          icon={<CreditCard className="w-5 h-5 text-green-600" />}
          iconBg="bg-green-100"
          title="Payment Methods"
          description="Update payment info"
        />
        <QuickLinkCard
          href="/app/client/settings"
          icon={<Bell className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-100"
          title="Notification Settings"
          description="Manage your preferences"
        />
        <QuickLinkCard
          href="/app/client/referrals"
          icon={<Heart className="w-5 h-5 text-rose-600" />}
          iconBg="bg-rose-100"
          title="Refer a Friend"
          description={
            data.referrals.converted > 0
              ? `${data.referrals.converted} successful referrals`
              : "Earn credit for referrals"
          }
        />
      </div>

      {/* Business Info Footer */}
      {hasContactInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hasAddress && org.address && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Address</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {org.address.line1}
                    {org.address.line2 && <><br />{org.address.line2}</>}
                    {(org.address.city || org.address.state) && (
                      <><br />{[org.address.city, org.address.state].filter(Boolean).join(", ")} {org.address.zipCode}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {org.phone && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Phone</p>
                  <p className="text-sm text-gray-500 mt-1">{org.phone}</p>
                  <div className="flex gap-3 mt-2">
                    {org.canCall && (
                      <a
                        href={`tel:${org.phone}`}
                        className="text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        Call Us
                      </a>
                    )}
                    {org.canText && (
                      <a
                        href={`sms:${org.phone}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Text Us
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {org.email && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <a
                    href={`mailto:${org.email}`}
                    className="text-sm text-teal-600 hover:text-teal-700 mt-1 inline-block"
                  >
                    {org.email}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickLinkCard({
  href,
  icon,
  iconBg,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${iconBg} rounded-full flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors flex-shrink-0" />
    </Link>
  );
}
