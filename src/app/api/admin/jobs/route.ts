/**
 * Admin Jobs API
 *
 * CRUD operations for job management.
 * Requires jobs:read for GET, jobs:write for POST/PUT.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
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

/**
 * GET /api/admin/jobs
 * List jobs with optional filtering
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "jobs:read");
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
  const clientId = searchParams.get("clientId");
  const locationId = searchParams.get("locationId");
  const routeId = searchParams.get("routeId");
  const unassigned = searchParams.get("unassigned"); // "true" to get jobs without routes
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  let query = supabase
    .from("jobs")
    .select(`
      *,
      client:client_id (
        id,
        first_name,
        last_name,
        phone,
        email,
        status
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
        frequency,
        price_per_visit_cents
      ),
      assigned_user:assigned_to (
        id,
        first_name,
        last_name
      ),
      route:route_id (
        id,
        name,
        status
      ),
      dogs:dogs!dogs_location_id_fkey (
        id,
        name,
        breed,
        is_safe,
        safety_notes,
        special_instructions
      )
    `, { count: "exact" })
    .eq("org_id", auth.user.orgId)
    .order("scheduled_date", { ascending: true })
    .order("route_order", { ascending: true, nullsFirst: false });

  // Apply filters
  if (date) {
    query = query.eq("scheduled_date", date);
  } else if (startDate && endDate) {
    query = query.gte("scheduled_date", startDate).lte("scheduled_date", endDate);
  } else if (startDate) {
    query = query.gte("scheduled_date", startDate);
  } else if (endDate) {
    query = query.lte("scheduled_date", endDate);
  }

  if (status) {
    const statuses = status.split(",");
    query = query.in("status", statuses);
  }

  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  if (routeId) {
    query = query.eq("route_id", routeId);
  }

  if (unassigned === "true") {
    query = query.is("route_id", null);
  }

  // Pagination
  if (limit) {
    query = query.limit(parseInt(limit));
  }

  if (offset) {
    query = query.range(parseInt(offset), parseInt(offset) + (parseInt(limit || "50") - 1));
  }

  const { data: jobs, error, count } = await query;

  if (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobs, total: count });
}

/**
 * POST /api/admin/jobs
 * Create a new job (ad-hoc, not from subscription)
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "jobs:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.client_id || !body.location_id || !body.scheduled_date) {
      return NextResponse.json(
        { error: "client_id, location_id, and scheduled_date are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify client belongs to org
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", body.client_id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Verify location belongs to client
    const { data: location } = await supabase
      .from("locations")
      .select("id")
      .eq("id", body.location_id)
      .eq("client_id", body.client_id)
      .single();

    if (!location) {
      return NextResponse.json(
        { error: "Location not found or does not belong to client" },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELED"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
    }

    // Create the job
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        org_id: auth.user.orgId,
        client_id: body.client_id,
        location_id: body.location_id,
        subscription_id: body.subscription_id || null,
        assigned_to: body.assigned_to || null,
        route_id: body.route_id || null,
        route_order: body.route_order || null,
        scheduled_date: body.scheduled_date,
        scheduled_time_start: body.scheduled_time_start || null,
        scheduled_time_end: body.scheduled_time_end || null,
        status: body.status || "SCHEDULED",
        price_cents: body.price_cents || 0,
        notes: body.notes || null,
        internal_notes: body.internal_notes || null,
        metadata: body.metadata || {},
      })
      .select(`
        *,
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
          city,
          zip_code
        )
      `)
      .single();

    if (error) {
      console.error("Error creating job:", error);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/jobs
 * Update an existing job
 */
export async function PUT(request: NextRequest) {
  // Can be updated by jobs:write or jobs:complete (for field techs)
  const auth = await authenticateWithAnyPermission(request, ["jobs:write", "jobs:complete"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify job belongs to org
    const { data: existing } = await supabase
      .from("jobs")
      .select("id, status, started_at")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    // Status updates
    if (body.status !== undefined) {
      const validStatuses = ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELED"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updates.status = body.status;

      // Auto-set timestamps based on status
      if (body.status === "IN_PROGRESS" && !existing.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (body.status === "COMPLETED") {
        updates.completed_at = new Date().toISOString();
        // Calculate duration if started
        const { data: jobWithStart } = await supabase
          .from("jobs")
          .select("started_at")
          .eq("id", body.id)
          .single();

        if (jobWithStart?.started_at) {
          const startTime = new Date(jobWithStart.started_at).getTime();
          const endTime = new Date().getTime();
          updates.duration_minutes = Math.round((endTime - startTime) / 60000);
        }
      }
    }

    // Skip reason
    if (body.skip_reason !== undefined) updates.skip_reason = body.skip_reason;

    // Assignment
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
    if (body.route_id !== undefined) updates.route_id = body.route_id;
    if (body.route_order !== undefined) updates.route_order = body.route_order;

    // Scheduling
    if (body.scheduled_date !== undefined) updates.scheduled_date = body.scheduled_date;
    if (body.scheduled_time_start !== undefined) updates.scheduled_time_start = body.scheduled_time_start;
    if (body.scheduled_time_end !== undefined) updates.scheduled_time_end = body.scheduled_time_end;

    // Pricing
    if (body.price_cents !== undefined) updates.price_cents = body.price_cents;

    // Notes
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes;

    // Photos
    if (body.photos !== undefined) updates.photos = body.photos;

    // Timestamps (manual override)
    if (body.started_at !== undefined) updates.started_at = body.started_at;
    if (body.completed_at !== undefined) updates.completed_at = body.completed_at;
    if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes;

    // Metadata
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    // Update the job
    const { data: job, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", body.id)
      .select(`
        *,
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
          city,
          zip_code
        )
      `)
      .single();

    if (error) {
      console.error("Error updating job:", error);
      return NextResponse.json(
        { error: "Failed to update job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/jobs
 * Cancel/delete a job
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "jobs:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hardDelete") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify job belongs to org
    const { data: existing } = await supabase
      .from("jobs")
      .select("id, status, route_id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Cannot delete completed jobs
    if (existing.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete completed jobs" },
        { status: 400 }
      );
    }

    // If job is on a route, remove it first
    if (existing.route_id) {
      await supabase
        .from("route_stops")
        .delete()
        .eq("job_id", id);
    }

    if (hardDelete) {
      // Hard delete
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting job:", error);
        return NextResponse.json(
          { error: "Failed to delete job" },
          { status: 500 }
        );
      }
    } else {
      // Soft delete - mark as canceled
      const { error } = await supabase
        .from("jobs")
        .update({
          status: "CANCELED",
          route_id: null,
          route_order: null,
        })
        .eq("id", id);

      if (error) {
        console.error("Error canceling job:", error);
        return NextResponse.json(
          { error: "Failed to cancel job" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
