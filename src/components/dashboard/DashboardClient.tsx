"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { StatusCard } from "./StatusCard";
import { StatusCardSmall } from "./StatusCardSmall";
import { ChartContainer } from "./ChartContainer";
import { MetricCard } from "./MetricCard";
import { ShortcutsSection } from "./ShortcutsSection";
import {
  TotalSalesChart,
  ActiveClientsChart,
  NewVsLostChart,
  CancelationReasonsChart,
  ReferralSourcesChart,
} from "./charts";
import type { DashboardMetrics, DashboardSettings, DashboardUser } from "@/lib/dashboard/types";

interface DashboardClientProps {
  user: DashboardUser;
}

// Default widget visibility - new widgets should be true by default
const DEFAULT_WIDGETS: Record<string, boolean> = {
  unassignedLocations: true,
  changeRequests: true,
  openOneTimeInvoices: true,
  openRecurringInvoices: true,
  overdueOneTimeInvoices: true,
  overdueRecurringInvoices: true,
  failedOneTimeInvoices: true,
  failedRecurringInvoices: true,
  openJobs: true,
  recurringInvoiceDrafts: true,
  oneTimeInvoiceDrafts: true,
  unoptimizedRoutes: true,
  openShifts: true,
  incompleteShifts: true,
  clockedInStaff: true,
  staffOnBreak: true,
  totalSales: true,
  activeResidentialClients: true,
  activeCommercialClients: true,
  newVsLostResidentialClients: true,
  newVsLostCommercialClients: true,
  averageResidentialClientValue: true,
  averageCommercialClientValue: true,
  residentialCancelationReasons: true,
  commercialCancelationReasons: true,
  referralSources: true,
  averageClientsPerTech: true,
  averageYardsPerHour: true,
  averageYardsPerRoute: true,
  churnRate: true,
  clientLifetimeValue: true,
};

const DEFAULT_SETTINGS: DashboardSettings = {
  widgets: DEFAULT_WIDGETS,
  shortcuts: {},
  assistance: {},
};

export function DashboardClient({ user }: DashboardClientProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, settingsRes] = await Promise.all([
        fetch("/api/admin/dashboard"),
        fetch("/api/admin/settings"),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const dashboardSettings = settingsData.settings?.dashboard || {};
        // Merge saved settings with defaults so new widgets show by default
        setSettings({
          widgets: { ...DEFAULT_WIDGETS, ...dashboardSettings.widgets },
          shortcuts: { ...dashboardSettings.shortcuts },
          assistance: { ...dashboardSettings.assistance },
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper to check widget visibility
  const isVisible = (key: string) => settings.widgets[key] !== false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        Failed to load dashboard data
      </div>
    );
  }

  const { counts, charts, metrics: metricValues } = metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader />

      {/* Primary Status Cards - 2 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isVisible("unassignedLocations") && (
          <StatusCard
            count={counts.unassignedLocations}
            title="Unassigned Locations"
            subtitle="Assign Tech & Service Day"
            href="/app/office/unassigned"
          />
        )}
        {isVisible("changeRequests") && (
          <StatusCard
            count={counts.changeRequests}
            title="Change Requests"
            subtitle="View Client Requests"
            href="/app/office/clients"
          />
        )}
        {isVisible("openOneTimeInvoices") && (
          <StatusCard
            count={counts.openOneTimeInvoices}
            title="Open One-Time Invoices"
            subtitle="View One-Time Invoices"
            href="/app/office/invoices?status=OPEN"
          />
        )}
        {isVisible("openRecurringInvoices") && (
          <StatusCard
            count={counts.openRecurringInvoices}
            title="Open Recurring Invoices"
            subtitle="View Recurring Invoices"
            href="/app/office/invoices?status=OPEN"
          />
        )}
        {isVisible("overdueOneTimeInvoices") && (
          <StatusCard
            count={counts.overdueOneTimeInvoices}
            title="Overdue One-Time Invoices"
            subtitle="View One-Time Invoices"
            href="/app/office/invoices?status=OVERDUE"
            highlight
          />
        )}
        {isVisible("overdueRecurringInvoices") && (
          <StatusCard
            count={counts.overdueRecurringInvoices}
            title="Overdue Recurring Invoices"
            subtitle="View Recurring Invoices"
            href="/app/office/invoices?status=OVERDUE"
            highlight
          />
        )}
        {isVisible("failedOneTimeInvoices") && (
          <StatusCard
            count={counts.failedOneTimeInvoices}
            title="Failed One-Time Invoices"
            subtitle="View One-Time Invoices"
            href="/app/office/invoices?status=UNCOLLECTIBLE"
            highlight
          />
        )}
        {isVisible("failedRecurringInvoices") && (
          <StatusCard
            count={counts.failedRecurringInvoices}
            title="Failed Recurring Invoices"
            subtitle="View Recurring Invoices"
            href="/app/office/invoices?status=UNCOLLECTIBLE"
            highlight
          />
        )}
      </div>

      {/* Open Jobs - Full width */}
      {isVisible("openJobs") && (
        <StatusCard
          count={counts.openJobs}
          title="Open Jobs"
          subtitle="View Dispatch Board"
          href="/app/office/scheduling"
        />
      )}

      {/* Secondary Status Cards - 4 column grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isVisible("recurringInvoiceDrafts") && (
          <StatusCardSmall
            count={counts.recurringInvoiceDrafts}
            title="Recurring Invoice Drafts"
            subtitle="View Recurring Invoices"
            href="/app/office/invoices?status=DRAFT&type=recurring"
          />
        )}
        {isVisible("oneTimeInvoiceDrafts") && (
          <StatusCardSmall
            count={counts.oneTimeInvoiceDrafts}
            title="One-Time Invoice Drafts"
            subtitle="View One-Time Invoices"
            href="/app/office/invoices?status=DRAFT&type=one-time"
          />
        )}
        {isVisible("unoptimizedRoutes") && (
          <StatusCardSmall
            count={counts.unoptimizedRoutes}
            title="Unoptimized Routes"
            subtitle="View Route Manager"
            href="/app/office/routes"
          />
        )}
        {isVisible("openShifts") && (
          <StatusCardSmall
            count={counts.openShifts}
            title="Open Shifts"
            subtitle="View Shifts"
            href="/app/office/shifts?status=SCHEDULED"
          />
        )}
        {isVisible("incompleteShifts") && (
          <StatusCardSmall
            count={counts.incompleteShifts}
            title="Incomplete Shifts"
            subtitle="View Shifts"
            href="/app/office/shifts?status=CLOCKED_IN"
          />
        )}
        {isVisible("clockedInStaff") && (
          <StatusCardSmall
            count={counts.clockedInStaff}
            title="Clocked In Staff"
            subtitle="View Shifts"
            href="/app/office/shifts?status=CLOCKED_IN"
          />
        )}
        {isVisible("staffOnBreak") && (
          <StatusCardSmall
            count={counts.staffOnBreak}
            title="Staff On Break"
            subtitle="View Shifts"
            href="/app/office/shifts?status=ON_BREAK"
          />
        )}
      </div>

      {/* Analytics Charts - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Sales */}
        {isVisible("totalSales") && (
          <ChartContainer
            title="Total Sales"
            info={
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Residential</span>
                  <p className="text-teal-600 font-semibold">
                    ${metricValues.totalSalesResidential.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Commercial</span>
                  <p className="text-amber-600 font-semibold">
                    ${metricValues.totalSalesCommercial.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Total</span>
                  <p className="text-gray-900 font-semibold">
                    ${metricValues.totalSalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            }
          >
            <p className="text-xs text-gray-400 mb-2">Note: Includes sales tax if any</p>
            <TotalSalesChart data={charts.totalSales} />
          </ChartContainer>
        )}

        {/* Active Res Clients */}
        {isVisible("activeResidentialClients") && (
          <ChartContainer
            title="Active Res Clients"
            info={
              <div className="text-sm">
                <span className="text-gray-500">Residential Clients</span>
                <p className="text-teal-600 font-semibold text-xl">{metricValues.activeResidentialClients}</p>
              </div>
            }
          >
            <ActiveClientsChart data={charts.activeResClients} label="Active Residential" color="#14b8a6" />
          </ChartContainer>
        )}

        {/* Active Comm Clients */}
        {isVisible("activeCommercialClients") && (
          <ChartContainer
            title="Active Comm Clients"
            info={
              <div className="text-sm">
                <span className="text-gray-500">Commercial Clients</span>
                <p className="text-amber-600 font-semibold text-xl">{metricValues.activeCommercialClients}</p>
              </div>
            }
          >
            <ActiveClientsChart data={charts.activeCommClients} label="Active Commercial" color="#f59e0b" />
          </ChartContainer>
        )}

        {/* New VS Lost Res Clients */}
        {isVisible("newVsLostResidentialClients") && (
          <ChartContainer
            title="New VS Lost Res Clients"
            info={
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">New Res Clients</span>
                  <p className="text-teal-600 font-semibold">{metricValues.newResClients}</p>
                </div>
                <div>
                  <span className="text-gray-500">Lost Res Clients</span>
                  <p className="text-red-600 font-semibold">{metricValues.lostResClients}</p>
                </div>
                <div>
                  <span className="text-gray-500">NET</span>
                  <p className={`font-semibold ${metricValues.netResClients >= 0 ? "text-teal-600" : "text-red-600"}`}>
                    {metricValues.netResClients}
                  </p>
                </div>
              </div>
            }
          >
            <p className="text-xs text-gray-400 mb-2">Note: Lost clients are clients that are disabled.</p>
            <NewVsLostChart
              data={charts.newVsLostRes}
              summary={{
                new: metricValues.newResClients,
                lost: metricValues.lostResClients,
                net: metricValues.netResClients,
              }}
            />
          </ChartContainer>
        )}

        {/* New VS Lost Comm Clients */}
        {isVisible("newVsLostCommercialClients") && (
          <ChartContainer
            title="New VS Lost Comm Clients"
            info={
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">New Comm Clients</span>
                  <p className="text-teal-600 font-semibold">{metricValues.newCommClients}</p>
                </div>
                <div>
                  <span className="text-gray-500">Lost Comm Clients</span>
                  <p className="text-red-600 font-semibold">{metricValues.lostCommClients}</p>
                </div>
                <div>
                  <span className="text-gray-500">NET</span>
                  <p className={`font-semibold ${metricValues.netCommClients >= 0 ? "text-teal-600" : "text-red-600"}`}>
                    {metricValues.netCommClients}
                  </p>
                </div>
              </div>
            }
          >
            <p className="text-xs text-gray-400 mb-2">Note: Lost clients are clients that are disabled.</p>
            <NewVsLostChart
              data={charts.newVsLostComm}
              summary={{
                new: metricValues.newCommClients,
                lost: metricValues.lostCommClients,
                net: metricValues.netCommClients,
              }}
            />
          </ChartContainer>
        )}

        {/* Average Res Client Value */}
        {isVisible("averageResidentialClientValue") && (
          <ChartContainer
            title="Average Res Client Value"
            info={
              <div className="text-sm">
                <span className="text-gray-500">Average Residential Client Value</span>
                <p className="text-teal-600 font-semibold text-xl">
                  ${metricValues.avgResClientValue.toFixed(2)}
                </p>
              </div>
            }
          >
            <ActiveClientsChart data={charts.avgResClientValue} label="Average" color="#14b8a6" />
          </ChartContainer>
        )}

        {/* Average Comm Client Value */}
        {isVisible("averageCommercialClientValue") && (
          <ChartContainer
            title="Average Comm Client Value"
            info={
              <div className="text-sm">
                <span className="text-gray-500">Average Commercial Client Value</span>
                <p className="text-amber-600 font-semibold text-xl">
                  ${metricValues.avgCommClientValue.toFixed(2)}
                </p>
              </div>
            }
          >
            <ActiveClientsChart data={charts.avgCommClientValue} label="Average" color="#f59e0b" />
          </ChartContainer>
        )}

        {/* Res Cancelation Reasons */}
        {isVisible("residentialCancelationReasons") && (
          <ChartContainer title="Res Cancelation Reasons">
            <CancelationReasonsChart data={charts.resCancelationReasons} />
          </ChartContainer>
        )}

        {/* Comm Cancelation Reasons */}
        {isVisible("commercialCancelationReasons") && (
          <ChartContainer title="Comm Cancelation Reasons">
            <CancelationReasonsChart data={charts.commCancelationReasons} />
          </ChartContainer>
        )}

        {/* Referral Sources */}
        {isVisible("referralSources") && (
          <ChartContainer title="Referral Sources">
            <ReferralSourcesChart data={charts.referralSources} />
          </ChartContainer>
        )}
      </div>

      {/* Metric Cards - 3 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isVisible("averageClientsPerTech") && (
          <MetricCard
            title="Avg Clients per Tech"
            metrics={[
              { label: "Residential", value: metricValues.avgResClientsPerTech.toFixed(2) },
              { label: "Commercial", value: metricValues.avgCommClientsPerTech.toFixed(2) },
            ]}
            note="Note: One time clients and staff without clients are excluded"
          />
        )}
        {isVisible("averageYardsPerHour") && (
          <MetricCard
            title="Avg Yards (Jobs) per Hour"
            metrics={[
              { label: "Residential", value: metricValues.avgResYardsPerHour.toFixed(2) },
              { label: "Commercial", value: metricValues.avgCommYardsPerHour.toFixed(2) },
            ]}
            note="Note: Skipped jobs are not counted"
          />
        )}
        {isVisible("averageYardsPerRoute") && (
          <MetricCard
            title="Avg Yards (Jobs) per Route"
            metrics={[
              { label: "Residential", value: metricValues.avgResYardsPerRoute.toFixed(2) },
              { label: "Commercial", value: metricValues.avgCommYardsPerRoute.toFixed(2) },
            ]}
          />
        )}
      </div>

      {/* Churn Rate and LTV - 2 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isVisible("churnRate") && (
          <MetricCard
            title="Churn Rate"
            metrics={[
              {
                label: "Residential",
                value: metricValues.resChurnRate !== null ? `${metricValues.resChurnRate.toFixed(2)}%` : "No data",
              },
              {
                label: "Commercial",
                value: metricValues.commChurnRate !== null ? `${metricValues.commChurnRate.toFixed(2)}%` : "No data",
              },
            ]}
          />
        )}
        {isVisible("clientLifetimeValue") && (
          <MetricCard
            title="Client Lifetime Value"
            metrics={[
              {
                label: "Current Month",
                value: metricValues.clientLifetimeValue !== null
                  ? `$${metricValues.clientLifetimeValue.toFixed(2)}`
                  : "—",
              },
            ]}
          />
        )}
      </div>

      {/* Shortcuts Section */}
      <ShortcutsSection settings={settings.shortcuts} />
    </div>
  );
}
