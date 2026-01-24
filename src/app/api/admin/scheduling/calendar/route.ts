/**
 * Scheduling Calendar API
 *
 * Provides calendar view data for job scheduling.
 * Requires jobs:read permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
  errorResponse,
} from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface DaySummary {
  date: string;
  total_jobs: number;
  scheduled: number;
  completed: number;
  skipped: number;
  canceled: number;
  unassigned: number;
  routes_count: number;
  revenue_scheduled: number;
  revenue_completed: number;
}

/**
 * GET /api/admin/scheduling/calendar
 * Get calendar data for a date range
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "jobs:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Date range (defaults to current month)
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const startDate = searchParams.get("startDate") || defaultStart.toISOString().split("T")[0];
  const endDate = searchParams.get("endDate") || defaultEnd.toISOString().split("T")[0];

  try {
    // Get all jobs in the date range
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        scheduled_date,
        status,
        route_id,
        price_cents
      `)
      .eq("org_id", auth.user.orgId)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate);

    if (jobsError) {
      console.error("Error fetching calendar jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch calendar data" },
        { status: 500 }
      );
    }

    // Get all routes in the date range
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select("id, route_date, status")
      .eq("org_id", auth.user.orgId)
      .gte("route_date", startDate)
      .lte("route_date", endDate);

    if (routesError) {
      console.error("Error fetching calendar routes:", routesError);
      return NextResponse.json(
        { error: "Failed to fetch calendar data" },
        { status: 500 }
      );
    }

    // Aggregate data by date
    const dateMap = new Map<string, DaySummary>();

    // Initialize all dates in range
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      dateMap.set(dateStr, {
        date: dateStr,
        total_jobs: 0,
        scheduled: 0,
        completed: 0,
        skipped: 0,
        canceled: 0,
        unassigned: 0,
        routes_count: 0,
        revenue_scheduled: 0,
        revenue_completed: 0,
      });
    }

    // Aggregate jobs
    if (jobs) {
      for (const job of jobs) {
        const summary = dateMap.get(job.scheduled_date);
        if (!summary) continue;

        summary.total_jobs++;

        switch (job.status) {
          case "SCHEDULED":
          case "EN_ROUTE":
          case "IN_PROGRESS":
            summary.scheduled++;
            break;
          case "COMPLETED":
            summary.completed++;
            break;
          case "SKIPPED":
            summary.skipped++;
            break;
          case "CANCELED":
            summary.canceled++;
            break;
        }

        if (!job.route_id && ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS"].includes(job.status)) {
          summary.unassigned++;
        }

        if (job.status !== "CANCELED") {
          summary.revenue_scheduled += job.price_cents || 0;
        }

        if (job.status === "COMPLETED") {
          summary.revenue_completed += job.price_cents || 0;
        }
      }
    }

    // Count routes per day
    if (routes) {
      for (const route of routes) {
        const summary = dateMap.get(route.route_date);
        if (summary) {
          summary.routes_count++;
        }
      }
    }

    // Convert to array and sort by date
    const calendar = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate totals
    const totals = {
      total_jobs: 0,
      scheduled: 0,
      completed: 0,
      skipped: 0,
      canceled: 0,
      unassigned: 0,
      revenue_scheduled: 0,
      revenue_completed: 0,
    };

    for (const day of calendar) {
      totals.total_jobs += day.total_jobs;
      totals.scheduled += day.scheduled;
      totals.completed += day.completed;
      totals.skipped += day.skipped;
      totals.canceled += day.canceled;
      totals.unassigned += day.unassigned;
      totals.revenue_scheduled += day.revenue_scheduled;
      totals.revenue_completed += day.revenue_completed;
    }

    return NextResponse.json({
      startDate,
      endDate,
      calendar,
      totals,
    });
  } catch (error) {
    console.error("Error in calendar:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar data" },
      { status: 500 }
    );
  }
}
