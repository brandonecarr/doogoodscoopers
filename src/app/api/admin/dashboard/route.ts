/**
 * Dashboard Metrics API
 *
 * Aggregates all dashboard metrics for the office dashboard.
 * Requires reports:read permission.
 *
 * GET /api/admin/dashboard - Get all dashboard metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import type { DashboardMetrics, StatusCardCounts, ChartData, MetricValues } from "@/lib/dashboard/types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Get date range for current month
function getCurrentMonthRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: startOfMonth.toISOString().split("T")[0],
    end: endOfMonth.toISOString().split("T")[0],
  };
}

// Get last 30 days as array of dates
function getLast30Days(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

// Type definitions for Supabase join results
interface PaymentWithClient {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  clients: { client_type: string }[];
}

interface SubscriptionWithClient {
  id: string;
  status: string;
  client_id: string;
  cancel_reason: string | null;
  canceled_at: string | null;
  created_at: string;
  clients: { client_type: string }[];
}

interface JobWithClient {
  id: string;
  status: string;
  scheduled_date: string;
  duration_minutes: number | null;
  assigned_to: string | null;
  route_id: string | null;
  clients: { client_type: string }[];
}

// Helper to get client_type from joined data
function getClientType(clients: { client_type: string }[] | null | undefined): string | null {
  if (!clients || clients.length === 0) return null;
  return clients[0]?.client_type || null;
}

// Cancellation reason colors
const CANCEL_REASON_COLORS: Record<string, string> = {
  "No response": "#94a3b8",
  "Moved": "#f59e0b",
  "Dog deceased": "#ef4444",
  "Got a fence/yard job done": "#10b981",
  "DIY attitude paid off": "#3b82f6",
  "Expensive": "#8b5cf6",
  "Inactive": "#6b7280",
  "Gift certificate used up": "#ec4899",
  "Miss payment": "#dc2626",
  "Slow Service Rolled": "#f97316",
  "Client Fired by Vendor": "#be123c",
  "Started With Competitor": "#7c3aed",
  "Other": "#64748b",
};

/**
 * GET /api/admin/dashboard
 * Get all dashboard metrics
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "reports:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;
  const today = new Date().toISOString().split("T")[0];
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const last30Days = getLast30Days();

  try {
    // Fetch all data in parallel
    const [
      // Status card counts
      activeSubscriptionsResult,
      unassignedJobsResult,
      openOneTimeInvoicesResult,
      openRecurringInvoicesResult,
      overdueOneTimeInvoicesResult,
      overdueRecurringInvoicesResult,
      failedOneTimeInvoicesResult,
      failedRecurringInvoicesResult,
      openJobsResult,
      recurringInvoiceDraftsResult,
      oneTimeInvoiceDraftsResult,
      unoptimizedRoutesResult,
      shiftsResult,
      staffResult,
      // Chart data
      paymentsResult,
      clientsResult,
      subscriptionsResult,
      jobsResult,
    ] = await Promise.all([
      // Active subscriptions for unassigned count (with location IDs)
      supabase
        .from("subscriptions")
        .select("id, initial_cleanup_required, initial_cleanup_completed, location_id")
        .eq("org_id", orgId)
        .eq("status", "ACTIVE"),

      // ALL jobs for active subscriptions (to detect no-jobs and unassigned)
      supabase
        .from("jobs")
        .select("subscription_id, route_id, status, scheduled_date")
        .eq("org_id", orgId)
        .not("subscription_id", "is", null),

      // Open one-time invoices (no subscription_id)
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "OPEN")
        .is("subscription_id", null),

      // Open recurring invoices (has subscription_id)
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "OPEN")
        .not("subscription_id", "is", null),

      // Overdue one-time invoices
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "OVERDUE")
        .is("subscription_id", null),

      // Overdue recurring invoices
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "OVERDUE")
        .not("subscription_id", "is", null),

      // Failed one-time invoices
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "FAILED")
        .is("subscription_id", null),

      // Failed recurring invoices
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "FAILED")
        .not("subscription_id", "is", null),

      // Open jobs (today)
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("scheduled_date", today)
        .in("status", ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS"]),

      // Recurring invoice drafts
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "DRAFT")
        .not("subscription_id", "is", null),

      // One-time invoice drafts
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "DRAFT")
        .is("subscription_id", null),

      // Unoptimized routes (routes without optimization)
      supabase
        .from("routes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("route_date", today)
        .is("optimized_at", null),

      // Shifts data for today
      supabase
        .from("shifts")
        .select("id, status, user_id, start_time, end_time, breaks")
        .eq("org_id", orgId)
        .eq("shift_date", today),

      // Staff data
      supabase
        .from("users")
        .select("id, is_active")
        .eq("org_id", orgId)
        .in("role", ["FIELD_TECH", "CREW_LEAD"]),

      // Payments for chart data (last 30 days)
      supabase
        .from("payments")
        .select("id, amount_cents, status, created_at, clients!inner(client_type)")
        .eq("org_id", orgId)
        .eq("status", "SUCCEEDED")
        .gte("created_at", last30Days[0])
        .lte("created_at", `${last30Days[29]}T23:59:59`),

      // Clients for chart data
      supabase
        .from("clients")
        .select("id, status, client_type, referral_source, created_at, canceled_at")
        .eq("org_id", orgId),

      // Subscriptions for chart and churn data
      supabase
        .from("subscriptions")
        .select("id, status, client_id, cancel_reason, canceled_at, created_at, clients!inner(client_type)")
        .eq("org_id", orgId),

      // Jobs for performance metrics
      supabase
        .from("jobs")
        .select("id, status, scheduled_date, duration_minutes, assigned_to, route_id, clients!inner(client_type)")
        .eq("org_id", orgId)
        .gte("scheduled_date", monthStart)
        .lte("scheduled_date", monthEnd),
    ]);

    // Calculate unassigned locations count
    // Must match the logic in /api/admin/unassigned-subscriptions
    const activeSubscriptions = activeSubscriptionsResult.data || [];
    const allSubJobs = (unassignedJobsResult.data || []) as { subscription_id: string; route_id: string | null; status: string; scheduled_date: string }[];

    // Build maps: which subscriptions have ANY jobs, and which have unassigned scheduled jobs
    const subsWithJobs = new Set<string>();
    const subsWithUnassignedJobs = new Set<string>();
    for (const job of allSubJobs) {
      if (job.subscription_id) {
        subsWithJobs.add(job.subscription_id);
        if (job.status === "SCHEDULED" && job.scheduled_date >= today && !job.route_id) {
          subsWithUnassignedJobs.add(job.subscription_id);
        }
      }
    }

    // Count subscriptions that are unassigned (conditions 1-3)
    const unassignedSubCount = activeSubscriptions.filter(sub => {
      const needsInitialCleanup = sub.initial_cleanup_required && !sub.initial_cleanup_completed;
      const needsRouteAssignment = subsWithUnassignedJobs.has(sub.id);
      const hasNoJobs = !subsWithJobs.has(sub.id);
      return needsInitialCleanup || needsRouteAssignment || hasNoJobs;
    }).length;

    // Count locations without any active subscription (condition 4)
    const locationIdsWithSubs = new Set(activeSubscriptions.map((s: { location_id: string }) => s.location_id));
    const { data: allActiveLocations } = await supabase
      .from("locations")
      .select("id, client:clients!inner(status)")
      .eq("org_id", orgId)
      .eq("is_active", true);

    const orphanedLocationCount = (allActiveLocations || []).filter((loc) => {
      const client = loc.client as unknown as { status: string };
      return !locationIdsWithSubs.has(loc.id) && client.status === "ACTIVE";
    }).length;

    const unassignedSubscriptionsCount = unassignedSubCount + orphanedLocationCount;

    // Process status card counts
    const counts: StatusCardCounts = {
      unassignedLocations: unassignedSubscriptionsCount,
      changeRequests: 0, // TODO: Implement change requests table
      openOneTimeInvoices: openOneTimeInvoicesResult.count || 0,
      openRecurringInvoices: openRecurringInvoicesResult.count || 0,
      overdueOneTimeInvoices: overdueOneTimeInvoicesResult.count || 0,
      overdueRecurringInvoices: overdueRecurringInvoicesResult.count || 0,
      failedOneTimeInvoices: failedOneTimeInvoicesResult.count || 0,
      failedRecurringInvoices: failedRecurringInvoicesResult.count || 0,
      openJobs: openJobsResult.count || 0,
      recurringInvoiceDrafts: recurringInvoiceDraftsResult.count || 0,
      oneTimeInvoiceDrafts: oneTimeInvoiceDraftsResult.count || 0,
      unoptimizedRoutes: unoptimizedRoutesResult.count || 0,
      openShifts: 0,
      incompleteShifts: 0,
      clockedInStaff: 0,
      staffOnBreak: 0,
    };

    // Process shifts data
    const shifts = shiftsResult.data || [];
    counts.openShifts = shifts.filter(s => s.status === "SCHEDULED").length;
    counts.incompleteShifts = shifts.filter(s => s.status === "IN_PROGRESS" && !s.end_time).length;
    counts.clockedInStaff = shifts.filter(s => s.status === "IN_PROGRESS" && s.start_time).length;
    counts.staffOnBreak = shifts.filter(s => {
      if (!s.breaks || !Array.isArray(s.breaks)) return false;
      return s.breaks.some((b: { end_time?: string }) => !b.end_time);
    }).length;

    // Process chart data
    const payments = (paymentsResult.data || []) as PaymentWithClient[];
    const clients = clientsResult.data || [];
    const subscriptions = (subscriptionsResult.data || []) as SubscriptionWithClient[];
    const jobs = (jobsResult.data || []) as JobWithClient[];

    // Total Sales Chart (daily for last 30 days)
    const totalSalesChart = last30Days.map(date => {
      const dayPayments = payments.filter(p => p.created_at?.startsWith(date));
      const residential = dayPayments
        .filter(p => getClientType(p.clients) === "RESIDENTIAL")
        .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
      const commercial = dayPayments
        .filter(p => getClientType(p.clients) === "COMMERCIAL")
        .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
      return {
        date,
        residential,
        commercial,
        total: residential + commercial,
      };
    });

    // Active Clients Charts (daily for last 30 days)
    const activeResClientsChart = last30Days.map(date => ({
      date,
      value: clients.filter(c =>
        c.client_type === "RESIDENTIAL" &&
        c.status === "ACTIVE" &&
        new Date(c.created_at) <= new Date(date)
      ).length,
    }));

    const activeCommClientsChart = last30Days.map(date => ({
      date,
      value: clients.filter(c =>
        c.client_type === "COMMERCIAL" &&
        c.status === "ACTIVE" &&
        new Date(c.created_at) <= new Date(date)
      ).length,
    }));

    // New vs Lost Clients Charts
    const newVsLostResChart = last30Days.map(date => {
      const newCount = clients.filter(c =>
        c.client_type === "RESIDENTIAL" &&
        c.created_at?.startsWith(date)
      ).length;
      const lostCount = clients.filter(c =>
        c.client_type === "RESIDENTIAL" &&
        c.canceled_at?.startsWith(date)
      ).length;
      return { date, new: newCount, lost: lostCount, net: newCount - lostCount };
    });

    const newVsLostCommChart = last30Days.map(date => {
      const newCount = clients.filter(c =>
        c.client_type === "COMMERCIAL" &&
        c.created_at?.startsWith(date)
      ).length;
      const lostCount = clients.filter(c =>
        c.client_type === "COMMERCIAL" &&
        c.canceled_at?.startsWith(date)
      ).length;
      return { date, new: newCount, lost: lostCount, net: newCount - lostCount };
    });

    // Average Client Value Charts
    const avgResClientValueChart = last30Days.map(date => {
      const dayPayments = payments.filter(p =>
        p.created_at?.startsWith(date) &&
        getClientType(p.clients) === "RESIDENTIAL"
      );
      const totalValue = dayPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      const uniqueClients = dayPayments.length;
      return { date, value: uniqueClients > 0 ? totalValue / uniqueClients / 100 : 0 };
    });

    const avgCommClientValueChart = last30Days.map(date => {
      const dayPayments = payments.filter(p =>
        p.created_at?.startsWith(date) &&
        getClientType(p.clients) === "COMMERCIAL"
      );
      const totalValue = dayPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      const uniqueClients = dayPayments.length;
      return { date, value: uniqueClients > 0 ? totalValue / uniqueClients / 100 : 0 };
    });

    // Cancellation Reasons
    const canceledResSubs = subscriptions.filter(s =>
      s.status === "CANCELED" &&
      getClientType(s.clients) === "RESIDENTIAL" &&
      s.cancel_reason
    );
    const resCancelReasonCounts: Record<string, number> = {};
    canceledResSubs.forEach(s => {
      const reason = s.cancel_reason || "Other";
      resCancelReasonCounts[reason] = (resCancelReasonCounts[reason] || 0) + 1;
    });
    const resCancelationReasons = Object.entries(resCancelReasonCounts).map(([reason, count]) => ({
      reason,
      count,
      color: CANCEL_REASON_COLORS[reason] || "#64748b",
    }));

    const canceledCommSubs = subscriptions.filter(s =>
      s.status === "CANCELED" &&
      getClientType(s.clients) === "COMMERCIAL" &&
      s.cancel_reason
    );
    const commCancelReasonCounts: Record<string, number> = {};
    canceledCommSubs.forEach(s => {
      const reason = s.cancel_reason || "Other";
      commCancelReasonCounts[reason] = (commCancelReasonCounts[reason] || 0) + 1;
    });
    const commCancelationReasons = Object.entries(commCancelReasonCounts).map(([reason, count]) => ({
      reason,
      count,
      color: CANCEL_REASON_COLORS[reason] || "#64748b",
    }));

    // Referral Sources
    const referralCounts: Record<string, number> = {};
    clients.filter(c => c.referral_source).forEach(c => {
      referralCounts[c.referral_source!] = (referralCounts[c.referral_source!] || 0) + 1;
    });
    const referralSources = Object.entries(referralCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const charts: ChartData = {
      totalSales: totalSalesChart,
      activeResClients: activeResClientsChart,
      activeCommClients: activeCommClientsChart,
      newVsLostRes: newVsLostResChart,
      newVsLostComm: newVsLostCommChart,
      avgResClientValue: avgResClientValueChart,
      avgCommClientValue: avgCommClientValueChart,
      resCancelationReasons,
      commCancelationReasons,
      referralSources,
    };

    // Calculate metric values
    const activeResClients = clients.filter(c => c.client_type === "RESIDENTIAL" && c.status === "ACTIVE");
    const activeCommClients = clients.filter(c => c.client_type === "COMMERCIAL" && c.status === "ACTIVE");
    const activeStaff = (staffResult.data || []).filter(s => s.is_active);
    const completedJobs = jobs.filter(j => j.status === "COMPLETED");

    // Monthly totals
    const monthResPayments = payments.filter(p =>
      getClientType(p.clients) === "RESIDENTIAL"
    );
    const monthCommPayments = payments.filter(p =>
      getClientType(p.clients) === "COMMERCIAL"
    );
    const totalSalesResidential = monthResPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
    const totalSalesCommercial = monthCommPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

    // New/Lost clients this month
    const newResThisMonth = clients.filter(c =>
      c.client_type === "RESIDENTIAL" &&
      c.created_at >= monthStart
    ).length;
    const lostResThisMonth = clients.filter(c =>
      c.client_type === "RESIDENTIAL" &&
      c.canceled_at && c.canceled_at >= monthStart
    ).length;
    const newCommThisMonth = clients.filter(c =>
      c.client_type === "COMMERCIAL" &&
      c.created_at >= monthStart
    ).length;
    const lostCommThisMonth = clients.filter(c =>
      c.client_type === "COMMERCIAL" &&
      c.canceled_at && c.canceled_at >= monthStart
    ).length;

    // Churn rate calculation (lost / (active + lost) * 100)
    const resChurnRate = activeResClients.length + lostResThisMonth > 0
      ? (lostResThisMonth / (activeResClients.length + lostResThisMonth)) * 100
      : null;
    const commChurnRate = activeCommClients.length + lostCommThisMonth > 0
      ? (lostCommThisMonth / (activeCommClients.length + lostCommThisMonth)) * 100
      : null;

    // Performance metrics
    const resJobs = completedJobs.filter(j => getClientType(j.clients) === "RESIDENTIAL");
    const commJobs = completedJobs.filter(j => getClientType(j.clients) === "COMMERCIAL");
    const totalResMinutes = resJobs.reduce((sum, j) => sum + (j.duration_minutes || 0), 0);
    const totalCommMinutes = commJobs.reduce((sum, j) => sum + (j.duration_minutes || 0), 0);

    // Unique routes with jobs
    const uniqueResRoutes = new Set(resJobs.filter(j => j.route_id).map(j => j.route_id)).size;
    const uniqueCommRoutes = new Set(commJobs.filter(j => j.route_id).map(j => j.route_id)).size;

    const metrics: MetricValues = {
      totalSalesResidential,
      totalSalesCommercial,
      totalSalesTotal: totalSalesResidential + totalSalesCommercial,
      activeResidentialClients: activeResClients.length,
      activeCommercialClients: activeCommClients.length,
      newResClients: newResThisMonth,
      lostResClients: lostResThisMonth,
      netResClients: newResThisMonth - lostResThisMonth,
      newCommClients: newCommThisMonth,
      lostCommClients: lostCommThisMonth,
      netCommClients: newCommThisMonth - lostCommThisMonth,
      avgResClientValue: activeResClients.length > 0 ? totalSalesResidential / activeResClients.length : 0,
      avgCommClientValue: activeCommClients.length > 0 ? totalSalesCommercial / activeCommClients.length : 0,
      avgResClientsPerTech: activeStaff.length > 0 ? activeResClients.length / activeStaff.length : 0,
      avgCommClientsPerTech: activeStaff.length > 0 ? activeCommClients.length / activeStaff.length : 0,
      avgResYardsPerHour: totalResMinutes > 0 ? (resJobs.length / (totalResMinutes / 60)) : 0,
      avgCommYardsPerHour: totalCommMinutes > 0 ? (commJobs.length / (totalCommMinutes / 60)) : 0,
      avgResYardsPerRoute: uniqueResRoutes > 0 ? resJobs.length / uniqueResRoutes : 0,
      avgCommYardsPerRoute: uniqueCommRoutes > 0 ? commJobs.length / uniqueCommRoutes : 0,
      resChurnRate,
      commChurnRate,
      clientLifetimeValue: null, // TODO: Calculate LTV based on historical data
    };

    const dashboardMetrics: DashboardMetrics = {
      counts,
      charts,
      metrics,
    };

    return NextResponse.json(dashboardMetrics);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return errorResponse("Failed to fetch dashboard data", 500);
  }
}
