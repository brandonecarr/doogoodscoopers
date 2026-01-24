/**
 * Field History API
 *
 * Get past jobs for the authenticated field tech with pagination.
 * Returns jobs that are COMPLETED or SKIPPED.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Allowed roles for field operations
const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

/**
 * GET /api/field/history
 * Get past completed/skipped jobs
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Pagination
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = (page - 1) * limit;

  // Date range filters
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Get routes assigned to this user that have completed jobs
  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id")
    .eq("assigned_to", auth.user.id)
    .eq("org_id", auth.user.orgId);

  if (routesError) {
    console.error("Error fetching routes:", routesError);
    return NextResponse.json(
      { error: "Failed to fetch route history" },
      { status: 500 }
    );
  }

  const routeIds = routes?.map((r) => r.id) || [];

  if (routeIds.length === 0) {
    return NextResponse.json({
      jobs: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  }

  // Build query for jobs
  let query = supabase
    .from("route_stops")
    .select(`
      id,
      stop_order,
      job:job_id (
        id,
        status,
        scheduled_date,
        started_at,
        completed_at,
        skip_reason,
        photos,
        client:client_id (
          id,
          first_name,
          last_name
        ),
        location:location_id (
          id,
          address_line1,
          city,
          zip_code
        )
      ),
      route:route_id (
        id,
        name,
        route_date
      )
    `, { count: "exact" })
    .in("route_id", routeIds);

  // Apply date filters if provided
  if (startDate || endDate) {
    // We need to filter by route_date through the route relation
    // This is tricky with Supabase, so we'll filter route IDs first
    let filteredRouteIds = routeIds;

    if (startDate || endDate) {
      let routeQuery = supabase
        .from("routes")
        .select("id")
        .in("id", routeIds);

      if (startDate) {
        routeQuery = routeQuery.gte("route_date", startDate);
      }
      if (endDate) {
        routeQuery = routeQuery.lte("route_date", endDate);
      }

      const { data: filteredRoutes } = await routeQuery;
      filteredRouteIds = filteredRoutes?.map((r) => r.id) || [];

      if (filteredRouteIds.length === 0) {
        return NextResponse.json({
          jobs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      query = supabase
        .from("route_stops")
        .select(`
          id,
          stop_order,
          job:job_id (
            id,
            status,
            scheduled_date,
            started_at,
            completed_at,
            skip_reason,
            photos,
            client:client_id (
              id,
              first_name,
              last_name
            ),
            location:location_id (
              id,
              address_line1,
              city,
              zip_code
            )
          ),
          route:route_id (
            id,
            name,
            route_date
          )
        `, { count: "exact" })
        .in("route_id", filteredRouteIds);
    }
  }

  // Execute query with pagination
  const { data: stops, error: stopsError, count } = await query
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (stopsError) {
    console.error("Error fetching job history:", stopsError);
    return NextResponse.json(
      { error: "Failed to fetch job history" },
      { status: 500 }
    );
  }

  // Filter to only completed/skipped jobs and format response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs = (stops || [])
    .filter((stop) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = stop.job as any;
      return job && ["COMPLETED", "SKIPPED"].includes(job.status);
    })
    .map((stop) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = stop.job as any;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const route = stop.route as any;

      const photoCount = job.photos?.length || 0;

      return {
        id: job.id,
        status: job.status,
        scheduledDate: job.scheduled_date,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        skipReason: job.skip_reason,
        photoCount,
        client: job.client ? {
          id: job.client.id,
          firstName: job.client.first_name,
          lastName: job.client.last_name,
        } : null,
        location: job.location ? {
          id: job.location.id,
          addressLine1: job.location.address_line1,
          city: job.location.city,
          zipCode: job.location.zip_code,
        } : null,
        route: route ? {
          id: route.id,
          name: route.name,
          date: route.route_date,
        } : null,
      };
    });

  // Sort by completed_at descending (most recent first)
  jobs.sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return dateB - dateA;
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}
