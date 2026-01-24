/**
 * Dispatch Board API
 *
 * Provides dispatch overview and real-time job status for the office portal.
 * Requires jobs:read or routes:read permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithAnyPermission,
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

interface JobStats {
  total: number;
  scheduled: number;
  en_route: number;
  in_progress: number;
  completed: number;
  skipped: number;
  canceled: number;
  unassigned: number;
}

interface RouteStats {
  total: number;
  planned: number;
  in_progress: number;
  completed: number;
}

/**
 * GET /api/admin/dispatch
 * Get dispatch overview for a specific date (defaults to today)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithAnyPermission(request, ["jobs:read", "routes:read"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Default to today
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    // Get all jobs for the date
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        route_id,
        route_order,
        scheduled_date,
        started_at,
        completed_at,
        duration_minutes,
        price_cents,
        assigned_to,
        client:client_id (
          id,
          first_name,
          last_name,
          phone
        ),
        location:location_id (
          id,
          address_line1,
          city,
          zip_code,
          latitude,
          longitude
        ),
        assigned_user:assigned_to (
          id,
          first_name,
          last_name
        )
      `)
      .eq("org_id", auth.user.orgId)
      .eq("scheduled_date", date)
      .order("route_order", { ascending: true, nullsFirst: false });

    if (jobsError) {
      console.error("Error fetching dispatch jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch dispatch data" },
        { status: 500 }
      );
    }

    // Get all routes for the date
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select(`
        id,
        name,
        status,
        route_date,
        start_time,
        end_time,
        start_odometer,
        end_odometer,
        assigned_user:assigned_to (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq("org_id", auth.user.orgId)
      .eq("route_date", date);

    if (routesError) {
      console.error("Error fetching dispatch routes:", routesError);
      return NextResponse.json(
        { error: "Failed to fetch dispatch data" },
        { status: 500 }
      );
    }

    // Calculate job statistics
    const jobStats: JobStats = {
      total: jobs?.length || 0,
      scheduled: 0,
      en_route: 0,
      in_progress: 0,
      completed: 0,
      skipped: 0,
      canceled: 0,
      unassigned: 0,
    };

    if (jobs) {
      for (const job of jobs) {
        switch (job.status) {
          case "SCHEDULED":
            jobStats.scheduled++;
            break;
          case "EN_ROUTE":
            jobStats.en_route++;
            break;
          case "IN_PROGRESS":
            jobStats.in_progress++;
            break;
          case "COMPLETED":
            jobStats.completed++;
            break;
          case "SKIPPED":
            jobStats.skipped++;
            break;
          case "CANCELED":
            jobStats.canceled++;
            break;
        }

        if (!job.route_id && job.status === "SCHEDULED") {
          jobStats.unassigned++;
        }
      }
    }

    // Calculate route statistics
    const routeStats: RouteStats = {
      total: routes?.length || 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
    };

    if (routes) {
      for (const route of routes) {
        switch (route.status) {
          case "PLANNED":
            routeStats.planned++;
            break;
          case "IN_PROGRESS":
            routeStats.in_progress++;
            break;
          case "COMPLETED":
            routeStats.completed++;
            break;
        }
      }
    }

    // Group jobs by route
    const jobsByRoute: Record<string, typeof jobs> = {
      unassigned: [],
    };

    if (routes) {
      for (const route of routes) {
        jobsByRoute[route.id] = [];
      }
    }

    if (jobs) {
      for (const job of jobs) {
        if (job.route_id && jobsByRoute[job.route_id]) {
          jobsByRoute[job.route_id].push(job);
        } else if (!job.route_id) {
          jobsByRoute.unassigned.push(job);
        }
      }
    }

    // Calculate revenue metrics
    const revenueMetrics = {
      scheduled_total: 0,
      completed_total: 0,
      completion_rate: 0,
    };

    if (jobs) {
      for (const job of jobs) {
        if (job.status !== "CANCELED") {
          revenueMetrics.scheduled_total += job.price_cents || 0;
        }
        if (job.status === "COMPLETED") {
          revenueMetrics.completed_total += job.price_cents || 0;
        }
      }

      if (jobStats.total > 0) {
        revenueMetrics.completion_rate = Math.round(
          (jobStats.completed / (jobStats.total - jobStats.canceled)) * 100
        );
      }
    }

    // Get active staff (those with shifts today or assigned to routes)
    const { data: activeStaff } = await supabase
      .from("shifts")
      .select(`
        id,
        status,
        clock_in,
        user:user_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq("org_id", auth.user.orgId)
      .eq("shift_date", date)
      .in("status", ["CLOCKED_IN", "ON_BREAK"]);

    return NextResponse.json({
      date,
      jobs: jobs || [],
      routes: routes || [],
      jobStats,
      routeStats,
      jobsByRoute,
      revenueMetrics,
      activeStaff: activeStaff || [],
    });
  } catch (error) {
    console.error("Error in dispatch:", error);
    return NextResponse.json(
      { error: "Failed to fetch dispatch data" },
      { status: 500 }
    );
  }
}
