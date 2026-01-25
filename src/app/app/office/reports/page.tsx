"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  DollarSign,
  Users,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  FileText,
  RefreshCw,
  Calendar,
  PieChart,
  Activity,
  AlertCircle,
} from "lucide-react";

interface RevenueMetrics {
  totalCollected: number;
  totalRefunded: number;
  netRevenue: number;
  paymentCount: number;
  averagePayment: number;
  byMethod: {
    card: number;
    cash: number;
    check: number;
    ach: number;
    other: number;
  };
}

interface JobMetrics {
  total: number;
  completed: number;
  skipped: number;
  canceled: number;
  scheduled: number;
  inProgress: number;
  completionRate: number;
  skipReasons: Record<string, number>;
}

interface ClientMetrics {
  total: number;
  active: number;
  paused: number;
  canceled: number;
  delinquent: number;
  newInPeriod: number;
  residential: number;
  commercial: number;
  retentionRate: number;
}

interface SubscriptionMetrics {
  total: number;
  active: number;
  paused: number;
  canceled: number;
  canceledInPeriod: number;
  mrr: number;
  byFrequency: {
    weekly: number;
    twiceWeekly: number;
    everyOtherWeek: number;
    monthly: number;
    oneTime: number;
  };
}

interface InvoiceMetrics {
  total: number;
  paid: number;
  sent: number;
  overdue: number;
  draft: number;
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number;
}

interface ChartData {
  dailyRevenue: { date: string; amount: number }[];
  dailyJobs: { date: string; completed: number; skipped: number }[];
}

interface ReportData {
  period: { startDate: string; endDate: string };
  revenue: RevenueMetrics;
  jobs: JobMetrics;
  clients: ClientMetrics;
  subscriptions: SubscriptionMetrics;
  invoices: InvoiceMetrics;
  charts: ChartData;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch reports");
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Analytics and business insights</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Analytics and business insights</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={fetchReports}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...(data?.charts.dailyRevenue.map(d => d.amount) || [1]));
  const maxJobs = Math.max(
    ...(data?.charts.dailyJobs.map(d => d.completed + d.skipped) || [1])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Analytics and business insights</p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange(7)}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              7 Days
            </button>
            <button
              onClick={() => setDateRange(30)}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              30 Days
            </button>
            <button
              onClick={() => setDateRange(90)}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              90 Days
            </button>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.revenue.netRevenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.revenue.paymentCount} payments
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CalendarCheck className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {data.jobs.completionRate}%
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Jobs Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.jobs.completed}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.jobs.skipped} skipped, {data.jobs.scheduled} scheduled
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-teal-600">
                  +{data.clients.newInPeriod}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.clients.active}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.clients.retentionRate}% retention rate
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm text-purple-600 font-medium">MRR</span>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Monthly Recurring</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.subscriptions.mrr)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.subscriptions.active} active subscriptions
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Revenue Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Daily Revenue</h3>
              </div>
              <div className="h-48 flex items-end gap-1">
                {data.charts.dailyRevenue.map((day, idx) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group relative"
                  >
                    <div
                      className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                      style={{
                        height: `${Math.max((day.amount / maxRevenue) * 100, 2)}%`,
                        minHeight: day.amount > 0 ? "4px" : "0",
                      }}
                    />
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {formatDate(day.date)}: {formatCurrency(day.amount)}
                    </div>
                    {idx % 7 === 0 && (
                      <span className="text-xs text-gray-400 mt-1 absolute -bottom-5">
                        {formatDate(day.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-4 border-t flex justify-between text-sm">
                <span className="text-gray-600">
                  Total: {formatCurrency(data.revenue.totalCollected)}
                </span>
                <span className="text-gray-600">
                  Avg/day: {formatCurrency(data.revenue.totalCollected / 30)}
                </span>
              </div>
            </div>

            {/* Daily Jobs Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarCheck className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Daily Jobs</h3>
              </div>
              <div className="h-48 flex items-end gap-1">
                {data.charts.dailyJobs.map((day, idx) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group relative"
                  >
                    <div className="w-full flex flex-col">
                      <div
                        className="w-full bg-yellow-400 rounded-t"
                        style={{
                          height: `${Math.max((day.skipped / maxJobs) * 100, 0)}%`,
                        }}
                      />
                      <div
                        className="w-full bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{
                          height: `${Math.max((day.completed / maxJobs) * 100, 2)}%`,
                          minHeight: day.completed > 0 ? "4px" : "0",
                        }}
                      />
                    </div>
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {formatDate(day.date)}: {day.completed} done, {day.skipped} skipped
                    </div>
                    {idx % 7 === 0 && (
                      <span className="text-xs text-gray-400 mt-1 absolute -bottom-5">
                        {formatDate(day.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-4 border-t flex justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-yellow-400 rounded" />
                    Skipped
                  </span>
                </div>
                <span className="text-gray-600">
                  {data.jobs.completionRate}% completion
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue by Method */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Revenue by Method</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Card", value: data.revenue.byMethod.card, color: "bg-blue-500" },
                  { label: "Cash", value: data.revenue.byMethod.cash, color: "bg-green-500" },
                  { label: "Check", value: data.revenue.byMethod.check, color: "bg-yellow-500" },
                  { label: "ACH", value: data.revenue.byMethod.ach, color: "bg-purple-500" },
                  { label: "Other", value: data.revenue.byMethod.other, color: "bg-gray-500" },
                ].filter(m => m.value > 0).map((method) => {
                  const percentage = data.revenue.totalCollected > 0
                    ? (method.value / data.revenue.totalCollected) * 100
                    : 0;
                  return (
                    <div key={method.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{method.label}</span>
                        <span className="font-medium">{formatCurrency(method.value)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${method.color} rounded-full`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.revenue.totalCollected === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No payments in this period
                  </p>
                )}
              </div>
            </div>

            {/* Subscription Frequency */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Subscriptions by Frequency</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Weekly", value: data.subscriptions.byFrequency.weekly, color: "bg-blue-500" },
                  { label: "Twice Weekly", value: data.subscriptions.byFrequency.twiceWeekly, color: "bg-teal-500" },
                  { label: "Every Other Week", value: data.subscriptions.byFrequency.everyOtherWeek, color: "bg-green-500" },
                  { label: "Monthly", value: data.subscriptions.byFrequency.monthly, color: "bg-yellow-500" },
                  { label: "One-Time", value: data.subscriptions.byFrequency.oneTime, color: "bg-gray-500" },
                ].filter(f => f.value > 0).map((freq) => {
                  const percentage = data.subscriptions.active > 0
                    ? (freq.value / data.subscriptions.active) * 100
                    : 0;
                  return (
                    <div key={freq.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{freq.label}</span>
                        <span className="font-medium">{freq.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${freq.color} rounded-full`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.subscriptions.active === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No active subscriptions
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Invoice Status</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{data.invoices.paid}</p>
                  <p className="text-xs text-green-700">Paid</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{data.invoices.sent}</p>
                  <p className="text-xs text-blue-700">Sent</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{data.invoices.overdue}</p>
                  <p className="text-xs text-red-700">Overdue</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{data.invoices.draft}</p>
                  <p className="text-xs text-gray-700">Draft</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Billed</span>
                  <span className="font-medium">{formatCurrency(data.invoices.totalBilled)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding</span>
                  <span className="font-medium text-orange-600">
                    {formatCurrency(data.invoices.outstanding)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Collection Rate</span>
                  <span className="font-medium">{data.invoices.collectionRate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Client Status</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{data.clients.active}</p>
                  <p className="text-sm text-gray-600">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-600">{data.clients.paused}</p>
                  <p className="text-sm text-gray-600">Paused</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{data.clients.canceled}</p>
                  <p className="text-sm text-gray-600">Canceled</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{data.clients.delinquent}</p>
                  <p className="text-sm text-gray-600">Delinquent</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                <span className="text-gray-600">
                  Residential: {data.clients.residential} | Commercial: {data.clients.commercial}
                </span>
                <span className="text-teal-600 font-medium">
                  +{data.clients.newInPeriod} new
                </span>
              </div>
            </div>

            {/* Refunds & Skips */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Refunds & Losses</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700 mb-1">Total Refunded</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.revenue.totalRefunded)}
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700 mb-1">Subscriptions Canceled</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {data.subscriptions.canceledInPeriod}
                  </p>
                </div>
              </div>
              {Object.keys(data.jobs.skipReasons).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Skip Reasons</p>
                  <div className="space-y-1">
                    {Object.entries(data.jobs.skipReasons)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([reason, count]) => (
                        <div key={reason} className="flex justify-between text-sm">
                          <span className="text-gray-600">{reason}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {Object.keys(data.jobs.skipReasons).length === 0 && (
                <p className="text-gray-500 text-sm text-center py-2">
                  No skipped jobs in this period
                </p>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg shadow p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Banknote className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Period Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-teal-100 text-sm">Gross Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.revenue.totalCollected)}</p>
              </div>
              <div>
                <p className="text-teal-100 text-sm">Refunds</p>
                <p className="text-2xl font-bold">-{formatCurrency(data.revenue.totalRefunded)}</p>
              </div>
              <div>
                <p className="text-teal-100 text-sm">Net Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.revenue.netRevenue)}</p>
              </div>
              <div>
                <p className="text-teal-100 text-sm">Avg. Payment</p>
                <p className="text-2xl font-bold">{formatCurrency(data.revenue.averagePayment)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
