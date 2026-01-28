/**
 * Admin Job Detail API
 *
 * GET a single job with full details including subscription, plan, and location info.
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

/**
 * GET /api/admin/jobs/[id]
 * Get a single job with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "jobs:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;

  const supabase = getSupabase();

  // Get the job with all related data
  const { data: job, error } = await supabase
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
        longitude,
        dogs (
          id,
          name,
          breed,
          is_safe,
          safety_notes,
          special_instructions,
          is_active
        )
      ),
      subscription:subscription_id (
        id,
        frequency,
        price_per_visit_cents,
        status,
        plan:plan_id (
          id,
          name,
          frequency
        )
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
      )
    `)
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (error) {
    console.error("Error fetching job:", error);
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }

  // Get last completed job for this client/location for "Last Service Date"
  const { data: lastJob } = await supabase
    .from("jobs")
    .select("scheduled_date, completed_at")
    .eq("client_id", job.client_id)
    .eq("location_id", job.location_id)
    .eq("org_id", auth.user.orgId)
    .eq("status", "COMPLETED")
    .lt("scheduled_date", job.scheduled_date)
    .order("scheduled_date", { ascending: false })
    .limit(1)
    .single();

  // Format the response
  const formattedJob = {
    id: job.id,
    status: job.status,
    scheduledDate: job.scheduled_date,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    durationMinutes: job.duration_minutes,
    notes: job.notes,
    internalNotes: job.internal_notes,
    skipReason: job.skip_reason,
    priceCents: job.price_cents,
    photos: job.photos,
    metadata: job.metadata,
    routeOrder: job.route_order,
    // Client info
    client: job.client ? {
      id: job.client.id,
      firstName: job.client.first_name,
      lastName: job.client.last_name,
      fullName: `${job.client.first_name || ""} ${job.client.last_name || ""}`.trim(),
      phone: job.client.phone,
      email: job.client.email,
      status: job.client.status,
    } : null,
    // Location info
    location: job.location ? {
      id: job.location.id,
      addressLine1: job.location.address_line1,
      addressLine2: job.location.address_line2,
      city: job.location.city,
      state: job.location.state,
      zipCode: job.location.zip_code,
      gateCode: job.location.gate_code,
      gateLocation: job.location.gate_location,
      accessNotes: job.location.access_notes,
      latitude: job.location.latitude,
      longitude: job.location.longitude,
      dogs: job.location.dogs || [],
    } : null,
    // Subscription info
    subscription: job.subscription ? {
      id: job.subscription.id,
      frequency: job.subscription.frequency,
      pricePerVisitCents: job.subscription.price_per_visit_cents,
      status: job.subscription.status,
      plan: job.subscription.plan ? {
        id: job.subscription.plan.id,
        name: job.subscription.plan.name,
        frequency: job.subscription.plan.frequency,
      } : null,
    } : null,
    // Assigned user
    assignedUser: job.assigned_user ? {
      id: job.assigned_user.id,
      firstName: job.assigned_user.first_name,
      lastName: job.assigned_user.last_name,
      fullName: `${job.assigned_user.first_name || ""} ${job.assigned_user.last_name || ""}`.trim(),
    } : null,
    // Route info
    route: job.route ? {
      id: job.route.id,
      name: job.route.name,
      status: job.route.status,
    } : null,
    // Last service date
    lastServiceDate: lastJob?.scheduled_date || null,
    // Computed fields
    jobType: job.subscription_id ? "Recurring" : "One Time",
    servicePlan: job.subscription?.plan?.frequency || job.metadata?.service_name || "Custom",
    pricingPlan: job.subscription?.plan?.name || "Custom",
    revenue: job.subscription?.price_per_visit_cents
      ? (job.subscription.price_per_visit_cents / 100).toFixed(2)
      : job.price_cents
        ? (job.price_cents / 100).toFixed(2)
        : "0.00",
    estimatedMinutes: job.metadata?.estimated_minutes || 30,
  };

  return NextResponse.json({ job: formattedJob });
}
