/**
 * Reports & Analytics API
 *
 * Fetch aggregated analytics data for the office dashboard.
 * Requires reports:read permission.
 *
 * GET /api/admin/reports - Get analytics data
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * GET /api/admin/reports
 * Get analytics data with optional date range
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "reports:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Date range defaults to last 30 days
  const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];
  const startDate = searchParams.get("startDate") ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    // Fetch all data in parallel
    const [
      paymentsResult,
      jobsResult,
      clientsResult,
      subscriptionsResult,
      invoicesResult,
    ] = await Promise.all([
      // Payments data
      supabase
        .from("payments")
        .select("id, amount_cents, status, payment_method, refund_amount_cents, created_at")
        .eq("org_id", auth.user.orgId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`),

      // Jobs data
      supabase
        .from("jobs")
        .select("id, status, scheduled_date, completed_at, skip_reason")
        .eq("org_id", auth.user.orgId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate),

      // Clients data - all time for counts
      supabase
        .from("clients")
        .select("id, status, created_at, client_type")
        .eq("org_id", auth.user.orgId),

      // Subscriptions data
      supabase
        .from("subscriptions")
        .select("id, status, frequency, price_per_visit_cents, created_at, canceled_at")
        .eq("org_id", auth.user.orgId),

      // Invoices data
      supabase
        .from("invoices")
        .select("id, status, total_cents, paid_cents, created_at")
        .eq("org_id", auth.user.orgId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`),
    ]);

    const payments = paymentsResult.data || [];
    const jobs = jobsResult.data || [];
    const clients = clientsResult.data || [];
    const subscriptions = subscriptionsResult.data || [];
    const invoices = invoicesResult.data || [];

    // Calculate revenue metrics
    const completedPayments = payments.filter(p => p.status === "COMPLETED");
    const refundedPayments = payments.filter(p => ["REFUNDED", "PARTIAL_REFUND"].includes(p.status));

    const revenueMetrics = {
      totalCollected: completedPayments.reduce((sum, p) => sum + p.amount_cents, 0),
      totalRefunded: refundedPayments.reduce((sum, p) => sum + (p.refund_amount_cents || 0), 0),
      netRevenue: completedPayments.reduce((sum, p) => sum + p.amount_cents, 0) -
                  refundedPayments.reduce((sum, p) => sum + (p.refund_amount_cents || 0), 0),
      paymentCount: completedPayments.length,
      averagePayment: completedPayments.length > 0
        ? Math.round(completedPayments.reduce((sum, p) => sum + p.amount_cents, 0) / completedPayments.length)
        : 0,
      byMethod: {
        card: completedPayments.filter(p => p.payment_method === "CARD").reduce((sum, p) => sum + p.amount_cents, 0),
        cash: completedPayments.filter(p => p.payment_method === "CASH").reduce((sum, p) => sum + p.amount_cents, 0),
        check: completedPayments.filter(p => p.payment_method === "CHECK").reduce((sum, p) => sum + p.amount_cents, 0),
        ach: completedPayments.filter(p => p.payment_method === "ACH").reduce((sum, p) => sum + p.amount_cents, 0),
        other: completedPayments.filter(p => p.payment_method === "OTHER").reduce((sum, p) => sum + p.amount_cents, 0),
      },
    };

    // Calculate job metrics
    const completedJobs = jobs.filter(j => j.status === "COMPLETED");
    const skippedJobs = jobs.filter(j => j.status === "SKIPPED");
    const canceledJobs = jobs.filter(j => j.status === "CANCELED");
    const scheduledJobs = jobs.filter(j => j.status === "SCHEDULED");

    const jobMetrics = {
      total: jobs.length,
      completed: completedJobs.length,
      skipped: skippedJobs.length,
      canceled: canceledJobs.length,
      scheduled: scheduledJobs.length,
      inProgress: jobs.filter(j => j.status === "IN_PROGRESS").length,
      completionRate: jobs.length > 0
        ? Math.round((completedJobs.length / jobs.length) * 100)
        : 0,
      skipReasons: skippedJobs.reduce((acc, j) => {
        const reason = j.skip_reason || "Unknown";
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Calculate client metrics
    const activeClients = clients.filter(c => c.status === "ACTIVE");
    const newClientsInPeriod = clients.filter(c =>
      c.created_at >= startDate && c.created_at <= `${endDate}T23:59:59`
    );

    const clientMetrics = {
      total: clients.length,
      active: activeClients.length,
      paused: clients.filter(c => c.status === "PAUSED").length,
      canceled: clients.filter(c => c.status === "CANCELED").length,
      delinquent: clients.filter(c => c.status === "DELINQUENT").length,
      newInPeriod: newClientsInPeriod.length,
      residential: clients.filter(c => c.client_type === "RESIDENTIAL").length,
      commercial: clients.filter(c => c.client_type === "COMMERCIAL").length,
      retentionRate: clients.length > 0
        ? Math.round((activeClients.length / clients.length) * 100)
        : 0,
    };

    // Calculate subscription metrics
    const activeSubscriptions = subscriptions.filter(s => s.status === "ACTIVE");
    const canceledInPeriod = subscriptions.filter(s =>
      s.canceled_at && s.canceled_at >= startDate && s.canceled_at <= `${endDate}T23:59:59`
    );

    const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, s) => {
      const pricePerVisit = s.price_per_visit_cents || 0;
      // Estimate monthly visits based on frequency
      let visitsPerMonth = 4; // Default to weekly
      if (s.frequency === "TWICE_WEEKLY") visitsPerMonth = 8;
      else if (s.frequency === "EVERY_OTHER_WEEK") visitsPerMonth = 2;
      else if (s.frequency === "MONTHLY") visitsPerMonth = 1;
      else if (s.frequency === "ONE_TIME") visitsPerMonth = 0;
      return sum + (pricePerVisit * visitsPerMonth);
    }, 0);

    const subscriptionMetrics = {
      total: subscriptions.length,
      active: activeSubscriptions.length,
      paused: subscriptions.filter(s => s.status === "PAUSED").length,
      canceled: subscriptions.filter(s => s.status === "CANCELED").length,
      canceledInPeriod: canceledInPeriod.length,
      mrr: monthlyRecurringRevenue,
      byFrequency: {
        weekly: activeSubscriptions.filter(s => s.frequency === "WEEKLY").length,
        twiceWeekly: activeSubscriptions.filter(s => s.frequency === "TWICE_WEEKLY").length,
        everyOtherWeek: activeSubscriptions.filter(s => s.frequency === "EVERY_OTHER_WEEK").length,
        monthly: activeSubscriptions.filter(s => s.frequency === "MONTHLY").length,
        oneTime: activeSubscriptions.filter(s => s.frequency === "ONE_TIME").length,
      },
    };

    // Calculate invoice metrics
    const paidInvoices = invoices.filter(i => i.status === "PAID");
    const overdueInvoices = invoices.filter(i => i.status === "OVERDUE");

    const invoiceMetrics = {
      total: invoices.length,
      paid: paidInvoices.length,
      sent: invoices.filter(i => i.status === "SENT").length,
      overdue: overdueInvoices.length,
      draft: invoices.filter(i => i.status === "DRAFT").length,
      totalBilled: invoices.reduce((sum, i) => sum + i.total_cents, 0),
      totalCollected: invoices.reduce((sum, i) => sum + (i.paid_cents || 0), 0),
      outstanding: invoices.reduce((sum, i) => sum + (i.total_cents - (i.paid_cents || 0)), 0),
      collectionRate: invoices.length > 0
        ? Math.round((paidInvoices.length / invoices.length) * 100)
        : 0,
    };

    // Daily revenue chart data (last 30 days)
    const dailyRevenue: { date: string; amount: number }[] = [];
    const dailyJobs: { date: string; completed: number; skipped: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      const dayPayments = payments.filter(p =>
        p.created_at.startsWith(dateStr) && p.status === "COMPLETED"
      );
      dailyRevenue.push({
        date: dateStr,
        amount: dayPayments.reduce((sum, p) => sum + p.amount_cents, 0),
      });

      const dayJobs = jobs.filter(j => j.scheduled_date === dateStr);
      dailyJobs.push({
        date: dateStr,
        completed: dayJobs.filter(j => j.status === "COMPLETED").length,
        skipped: dayJobs.filter(j => j.status === "SKIPPED").length,
      });
    }

    return NextResponse.json({
      period: { startDate, endDate },
      revenue: revenueMetrics,
      jobs: jobMetrics,
      clients: clientMetrics,
      subscriptions: subscriptionMetrics,
      invoices: invoiceMetrics,
      charts: {
        dailyRevenue,
        dailyJobs,
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
