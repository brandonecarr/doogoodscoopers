/**
 * Admin Routes API
 *
 * CRUD operations for route management.
 * Requires routes:read for GET, routes:write for POST/PUT/DELETE.
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

/**
 * GET /api/admin/routes
 * List routes with optional filtering
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Filters
  const date = searchParams.get("date"); // YYYY-MM-DD
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assignedTo");

  let query = supabase
    .from("routes")
    .select(`
      *,
      assigned_user:assigned_to (
        id,
        first_name,
        last_name,
        email
      ),
      stops:route_stops (
        id,
        stop_order,
        estimated_arrival,
        actual_arrival,
        job:job_id (
          id,
          status,
          scheduled_date,
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
        )
      )
    `)
    .eq("org_id", auth.user.orgId)
    .order("route_date", { ascending: true });

  // Apply filters
  if (date) {
    query = query.eq("route_date", date);
  } else if (startDate && endDate) {
    query = query.gte("route_date", startDate).lte("route_date", endDate);
  } else if (startDate) {
    query = query.gte("route_date", startDate);
  } else if (endDate) {
    query = query.lte("route_date", endDate);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { data: routes, error } = await query;

  if (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }

  // Sort stops by stop_order
  if (routes) {
    for (const route of routes) {
      if (route.stops) {
        route.stops.sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order);
      }
    }
  }

  return NextResponse.json({ routes });
}

/**
 * POST /api/admin/routes
 * Create a new route
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.route_date) {
      return NextResponse.json(
        { error: "route_date is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Create the route
    const { data: route, error } = await supabase
      .from("routes")
      .insert({
        org_id: auth.user.orgId,
        route_date: body.route_date,
        name: body.name || null,
        assigned_to: body.assigned_to || null,
        status: "PLANNED",
        notes: body.notes || null,
      })
      .select(`
        *,
        assigned_user:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error("Error creating route:", error);
      return NextResponse.json(
        { error: "Failed to create route" },
        { status: 500 }
      );
    }

    return NextResponse.json({ route }, { status: 201 });
  } catch (error) {
    console.error("Error creating route:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/routes
 * Update an existing route
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Route ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify route belongs to org
    const { data: existing } = await supabase
      .from("routes")
      .select("id, status")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
    if (body.status !== undefined) {
      const validStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.start_odometer !== undefined) updates.start_odometer = body.start_odometer;
    if (body.end_odometer !== undefined) updates.end_odometer = body.end_odometer;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Update the route
    const { data: route, error } = await supabase
      .from("routes")
      .update(updates)
      .eq("id", body.id)
      .select(`
        *,
        assigned_user:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error("Error updating route:", error);
      return NextResponse.json(
        { error: "Failed to update route" },
        { status: 500 }
      );
    }

    return NextResponse.json({ route });
  } catch (error) {
    console.error("Error updating route:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/routes
 * Delete a route
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Route ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify route belongs to org and is not in progress
    const { data: existing } = await supabase
      .from("routes")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    if (existing.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot delete a route that is in progress" },
        { status: 400 }
      );
    }

    // First, unassign all jobs from this route
    await supabase
      .from("jobs")
      .update({ route_id: null, route_order: null })
      .eq("route_id", id);

    // Delete route stops
    await supabase
      .from("route_stops")
      .delete()
      .eq("route_id", id);

    // Delete the route
    const { error } = await supabase
      .from("routes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting route:", error);
      return NextResponse.json(
        { error: "Failed to delete route" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting route:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
