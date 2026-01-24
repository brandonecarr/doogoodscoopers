/**
 * Field Job Status API
 *
 * Update job status for the authenticated field tech.
 * Supports: en_route, start, complete, skip actions.
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

// Valid job status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["EN_ROUTE", "SKIPPED"],
  EN_ROUTE: ["IN_PROGRESS", "SKIPPED"],
  IN_PROGRESS: ["COMPLETED", "SKIPPED"],
  SKIPPED: [], // Terminal state
  COMPLETED: [], // Terminal state
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field/job/[id]
 * Get a specific job's details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const { id } = await params;
  const supabase = getSupabase();

  // Get the job with full details
  const { data: job, error } = await supabase
    .from("jobs")
    .select(`
      id,
      status,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      notes,
      internal_notes,
      skip_reason,
      photos,
      started_at,
      completed_at,
      client:client_id (
        id,
        first_name,
        last_name,
        phone,
        email,
        notification_preferences
      ),
      location:location_id (
        id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        lat,
        lng,
        gate_code,
        gate_location,
        access_notes,
        special_instructions
      )
    `)
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Get dogs for the location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locationData = job.location as any;
  const locationId = locationData?.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dogs: any[] = [];

  if (locationId) {
    const { data: locationDogs } = await supabase
      .from("dogs")
      .select(`
        id,
        name,
        breed,
        is_safe,
        safety_notes,
        special_instructions
      `)
      .eq("location_id", locationId);

    dogs = locationDogs || [];
  }

  // Format response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = job.client as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const location = job.location as any;

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      scheduledDate: job.scheduled_date,
      scheduledTimeStart: job.scheduled_time_start,
      scheduledTimeEnd: job.scheduled_time_end,
      notes: job.notes,
      internalNotes: job.internal_notes,
      skipReason: job.skip_reason,
      photos: job.photos || [],
      startedAt: job.started_at,
      completedAt: job.completed_at,
      client: client ? {
        id: client.id,
        firstName: client.first_name,
        lastName: client.last_name,
        phone: client.phone,
        email: client.email,
        notificationPreferences: client.notification_preferences,
      } : null,
      location: location ? {
        id: location.id,
        addressLine1: location.address_line1,
        addressLine2: location.address_line2,
        city: location.city,
        state: location.state,
        zipCode: location.zip_code,
        lat: location.lat,
        lng: location.lng,
        gateCode: location.gate_code,
        gateLocation: location.gate_location,
        accessNotes: location.access_notes,
        specialInstructions: location.special_instructions,
      } : null,
      dogs: dogs.map((dog) => ({
        id: dog.id,
        name: dog.name,
        breed: dog.breed,
        isSafe: dog.is_safe,
        safetyNotes: dog.safety_notes,
        specialInstructions: dog.special_instructions,
      })),
    },
  });
}

/**
 * PUT /api/field/job/[id]
 * Update job status
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { action, skipReason, notes } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Get current job status
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, org_id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Map action to new status
    const actionToStatus: Record<string, string> = {
      en_route: "EN_ROUTE",
      start: "IN_PROGRESS",
      complete: "COMPLETED",
      skip: "SKIPPED",
    };

    const newStatus = actionToStatus[action];
    if (!newStatus) {
      return NextResponse.json(
        { error: "Invalid action. Use: en_route, start, complete, skip" },
        { status: 400 }
      );
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[job.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${job.status} to ${newStatus}`,
          currentStatus: job.status,
          allowedTransitions
        },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add timestamps based on action
    if (action === "start") {
      updates.started_at = new Date().toISOString();
    } else if (action === "complete") {
      updates.completed_at = new Date().toISOString();
    } else if (action === "skip") {
      if (!skipReason) {
        return NextResponse.json(
          { error: "Skip reason is required" },
          { status: 400 }
        );
      }
      updates.skip_reason = skipReason;
      updates.completed_at = new Date().toISOString();
    }

    // Add notes if provided
    if (notes) {
      updates.internal_notes = notes;
    }

    // Update the job
    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating job:", updateError);
      return NextResponse.json(
        { error: "Failed to update job" },
        { status: 500 }
      );
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: `JOB_${action.toUpperCase()}`,
      entity_type: "JOB",
      entity_id: id,
      details: {
        previousStatus: job.status,
        newStatus,
        skipReason: action === "skip" ? skipReason : undefined,
      },
    });

    return NextResponse.json({
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        startedAt: updatedJob.started_at,
        completedAt: updatedJob.completed_at,
        skipReason: updatedJob.skip_reason,
      },
      message: `Job ${action === "complete" ? "completed" : action === "skip" ? "skipped" : "updated"} successfully`,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
