/**
 * Route Stops Management API
 *
 * Manage stops (jobs) within a route.
 * Requires routes:write permission.
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/routes/[id]/stops
 * Get all stops for a route
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: routeId } = await params;
  const supabase = getSupabase();

  // Verify route belongs to org
  const { data: route } = await supabase
    .from("routes")
    .select("id, route_date")
    .eq("id", routeId)
    .eq("org_id", auth.user.orgId)
    .single();

  if (!route) {
    return NextResponse.json(
      { error: "Route not found" },
      { status: 404 }
    );
  }

  // Get stops with job details
  const { data: stops, error } = await supabase
    .from("route_stops")
    .select(`
      id,
      stop_order,
      estimated_arrival,
      actual_arrival,
      job:job_id (
        id,
        status,
        scheduled_date,
        price_cents,
        notes,
        client:client_id (
          id,
          first_name,
          last_name,
          phone,
          email
        ),
        location:location_id (
          id,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          gate_code,
          gate_location,
          access_notes,
          latitude,
          longitude
        ),
        subscription:subscription_id (
          id,
          frequency
        )
      )
    `)
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });

  if (error) {
    console.error("Error fetching route stops:", error);
    return NextResponse.json(
      { error: "Failed to fetch route stops" },
      { status: 500 }
    );
  }

  return NextResponse.json({ stops });
}

/**
 * POST /api/admin/routes/[id]/stops
 * Add a job to a route as a stop
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: routeId } = await params;

  try {
    const body = await request.json();

    if (!body.job_id) {
      return NextResponse.json(
        { error: "job_id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify route belongs to org
    const { data: route } = await supabase
      .from("routes")
      .select("id, route_date, org_id")
      .eq("id", routeId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    // Verify job belongs to org and is on the same date
    const { data: job } = await supabase
      .from("jobs")
      .select("id, scheduled_date, route_id, org_id")
      .eq("id", body.job_id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.scheduled_date !== route.route_date) {
      return NextResponse.json(
        { error: "Job date does not match route date" },
        { status: 400 }
      );
    }

    if (job.route_id && job.route_id !== routeId) {
      return NextResponse.json(
        { error: "Job is already assigned to another route" },
        { status: 400 }
      );
    }

    // Get the next stop order
    const { data: maxStop } = await supabase
      .from("route_stops")
      .select("stop_order")
      .eq("route_id", routeId)
      .order("stop_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxStop?.stop_order ?? 0) + 1;
    const stopOrder = body.stop_order ?? nextOrder;

    // If inserting at a specific position, shift existing stops
    if (body.stop_order && body.stop_order < nextOrder) {
      // Get all stops that need to be shifted
      const { data: stopsToShift } = await supabase
        .from("route_stops")
        .select("id, stop_order")
        .eq("route_id", routeId)
        .gte("stop_order", body.stop_order)
        .order("stop_order", { ascending: false });

      if (stopsToShift) {
        for (const stop of stopsToShift) {
          await supabase
            .from("route_stops")
            .update({ stop_order: stop.stop_order + 1 })
            .eq("id", stop.id);
        }
      }
    }

    // Create the route stop
    const { data: stop, error: stopError } = await supabase
      .from("route_stops")
      .insert({
        org_id: auth.user.orgId,
        route_id: routeId,
        job_id: body.job_id,
        stop_order: stopOrder,
        estimated_arrival: body.estimated_arrival || null,
      })
      .select()
      .single();

    if (stopError) {
      console.error("Error creating route stop:", stopError);
      return NextResponse.json(
        { error: "Failed to add job to route" },
        { status: 500 }
      );
    }

    // Update the job with route assignment
    await supabase
      .from("jobs")
      .update({
        route_id: routeId,
        route_order: stopOrder,
      })
      .eq("id", body.job_id);

    return NextResponse.json({ stop }, { status: 201 });
  } catch (error) {
    console.error("Error adding stop to route:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/routes/[id]/stops
 * Reorder stops in a route
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: routeId } = await params;

  try {
    const body = await request.json();

    if (!body.stops || !Array.isArray(body.stops)) {
      return NextResponse.json(
        { error: "stops array is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify route belongs to org
    const { data: route } = await supabase
      .from("routes")
      .select("id")
      .eq("id", routeId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    // Update each stop's order
    for (let i = 0; i < body.stops.length; i++) {
      const stopId = body.stops[i].id || body.stops[i];
      const newOrder = i + 1;

      // Update route_stop
      await supabase
        .from("route_stops")
        .update({ stop_order: newOrder })
        .eq("id", stopId)
        .eq("route_id", routeId);

      // Get the job_id for this stop and update the job's route_order
      const { data: stopData } = await supabase
        .from("route_stops")
        .select("job_id")
        .eq("id", stopId)
        .single();

      if (stopData?.job_id) {
        await supabase
          .from("jobs")
          .update({ route_order: newOrder })
          .eq("id", stopData.job_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering stops:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/routes/[id]/stops
 * Remove a stop from a route
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: routeId } = await params;
  const { searchParams } = new URL(request.url);
  const stopId = searchParams.get("stopId");
  const jobId = searchParams.get("jobId");

  if (!stopId && !jobId) {
    return NextResponse.json(
      { error: "stopId or jobId is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Verify route belongs to org
  const { data: route } = await supabase
    .from("routes")
    .select("id")
    .eq("id", routeId)
    .eq("org_id", auth.user.orgId)
    .single();

  if (!route) {
    return NextResponse.json(
      { error: "Route not found" },
      { status: 404 }
    );
  }

  // Find the stop
  let stopQuery = supabase
    .from("route_stops")
    .select("id, job_id, stop_order")
    .eq("route_id", routeId);

  if (stopId) {
    stopQuery = stopQuery.eq("id", stopId);
  } else if (jobId) {
    stopQuery = stopQuery.eq("job_id", jobId);
  }

  const { data: stop } = await stopQuery.single();

  if (!stop) {
    return NextResponse.json(
      { error: "Stop not found" },
      { status: 404 }
    );
  }

  // Remove the job from the route
  await supabase
    .from("jobs")
    .update({ route_id: null, route_order: null })
    .eq("id", stop.job_id);

  // Delete the stop
  const { error } = await supabase
    .from("route_stops")
    .delete()
    .eq("id", stop.id);

  if (error) {
    console.error("Error removing stop:", error);
    return NextResponse.json(
      { error: "Failed to remove stop from route" },
      { status: 500 }
    );
  }

  // Reorder remaining stops
  const { data: remainingStops } = await supabase
    .from("route_stops")
    .select("id, job_id, stop_order")
    .eq("route_id", routeId)
    .gt("stop_order", stop.stop_order)
    .order("stop_order", { ascending: true });

  if (remainingStops) {
    for (const remainingStop of remainingStops) {
      const newOrder = remainingStop.stop_order - 1;
      await supabase
        .from("route_stops")
        .update({ stop_order: newOrder })
        .eq("id", remainingStop.id);

      await supabase
        .from("jobs")
        .update({ route_order: newOrder })
        .eq("id", remainingStop.job_id);
    }
  }

  return NextResponse.json({ success: true });
}
