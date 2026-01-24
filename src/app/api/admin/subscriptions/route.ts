/**
 * Admin Subscriptions API
 *
 * CRUD operations for subscription management.
 * Handles subscription changes with automatic job void/regeneration.
 * Requires subscriptions:read for GET, subscriptions:write for POST/PUT.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
  errorResponse,
} from "@/lib/api-auth";
import {
  voidFutureJobsForSubscription,
  regenerateJobsForSubscription,
} from "@/lib/subscription-jobs";

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
 * GET /api/admin/subscriptions
 * List subscriptions with optional filtering
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "subscriptions:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Filters
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const frequency = searchParams.get("frequency");

  let query = supabase
    .from("subscriptions")
    .select(`
      *,
      client:client_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      location:location_id (
        id,
        address_line1,
        city,
        zip_code
      ),
      plan:plan_id (
        id,
        name,
        frequency
      )
    `)
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (frequency) {
    query = query.eq("frequency", frequency);
  }

  const { data: subscriptions, error } = await query;

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ subscriptions });
}

/**
 * PUT /api/admin/subscriptions
 * Update a subscription with automatic job void/regeneration
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "subscriptions:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get the existing subscription
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    let needsJobRegeneration = false;
    let shouldVoidFutureJobs = false;

    // Status changes
    if (body.status !== undefined && body.status !== existing.status) {
      const validStatuses = ["ACTIVE", "PAUSED", "CANCELED", "PAST_DUE"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updates.status = body.status;

      // If pausing or canceling, void future jobs
      if (body.status === "PAUSED" || body.status === "CANCELED") {
        shouldVoidFutureJobs = true;
        if (body.status === "CANCELED") {
          updates.canceled_at = new Date().toISOString();
          updates.cancel_reason = body.cancel_reason || null;
        }
      }

      // If reactivating, regenerate jobs
      if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
        needsJobRegeneration = true;
      }
    }

    // Frequency changes
    if (body.frequency !== undefined && body.frequency !== existing.frequency) {
      const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          { error: "Invalid frequency" },
          { status: 400 }
        );
      }
      updates.frequency = body.frequency;
      shouldVoidFutureJobs = true;
      if (existing.status === "ACTIVE" || body.status === "ACTIVE") {
        needsJobRegeneration = true;
      }
    }

    // Preferred day changes
    if (body.preferred_day !== undefined) {
      const validDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", null];
      if (!validDays.includes(body.preferred_day)) {
        return NextResponse.json(
          { error: "Invalid preferred_day" },
          { status: 400 }
        );
      }
      updates.preferred_day = body.preferred_day;
      shouldVoidFutureJobs = true;
      needsJobRegeneration = true;
    }

    // Price changes
    if (body.price_per_visit_cents !== undefined) {
      updates.price_per_visit_cents = body.price_per_visit_cents;
    }

    // Pause dates
    if (body.pause_start_date !== undefined) {
      updates.pause_start_date = body.pause_start_date;
    }
    if (body.pause_end_date !== undefined) {
      updates.pause_end_date = body.pause_end_date;
    }

    // Next service date
    if (body.next_service_date !== undefined) {
      updates.next_service_date = body.next_service_date;
    }

    // Notes
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    // Void future jobs if needed
    let voidedJobsCount = 0;

    if (shouldVoidFutureJobs) {
      voidedJobsCount = await voidFutureJobsForSubscription(
        supabase,
        body.id,
        auth.user.orgId,
        "Subscription changed"
      );
    }

    // Update the subscription
    const { data: subscription, error: updateError } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating subscription:", updateError);
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }

    // Regenerate jobs if needed
    let generatedJobsCount = 0;
    if (needsJobRegeneration && subscription.status === "ACTIVE") {
      generatedJobsCount = await regenerateJobsForSubscription(
        supabase,
        {
          id: subscription.id,
          client_id: subscription.client_id,
          location_id: subscription.location_id,
          frequency: subscription.frequency,
          preferred_day: subscription.preferred_day,
          price_per_visit_cents: subscription.price_per_visit_cents,
          created_at: subscription.created_at,
          status: subscription.status,
        },
        auth.user.orgId,
        14 // Generate 2 weeks ahead
      );
    }

    return NextResponse.json({
      subscription,
      jobsVoided: voidedJobsCount,
      jobsGenerated: generatedJobsCount,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
