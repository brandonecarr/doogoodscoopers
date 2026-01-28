/**
 * Subscription Assignment API
 *
 * Assigns tech and route to a subscription.
 * Creates initial cleanup job if specified.
 * Updates recurring jobs with tech and route assignment.
 *
 * Requires subscriptions:write permission.
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

interface AssignmentRequest {
  subscriptionId: string;
  initialCleanup?: {
    date: string;
    techId: string;
    estimatedMinutes: number;
  };
  recurringService: {
    startDate: string;
    serviceDays: string[];
    techId: string;
    estimatedMinutes: number;
  };
}

/**
 * Find or create a route for a tech on a specific date
 */
async function findOrCreateRoute(
  supabase: ReturnType<typeof getSupabase>,
  orgId: string,
  techId: string,
  routeDate: string
): Promise<string> {
  // Check for existing route
  const { data: existingRoute } = await supabase
    .from("routes")
    .select("id")
    .eq("org_id", orgId)
    .eq("assigned_to", techId)
    .eq("route_date", routeDate)
    .single();

  if (existingRoute) {
    return existingRoute.id;
  }

  // Get tech name for route name
  const { data: tech } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", techId)
    .single();

  const techName = tech
    ? `${tech.first_name || ""} ${tech.last_name || ""}`.trim()
    : "Tech";

  // Create new route
  const { data: newRoute, error } = await supabase
    .from("routes")
    .insert({
      org_id: orgId,
      route_date: routeDate,
      assigned_to: techId,
      name: `${techName} - ${routeDate}`,
      status: "PLANNED",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create route: ${error.message}`);
  }

  return newRoute.id;
}

/**
 * POST /api/admin/unassigned-subscriptions/assign
 * Assign tech and route to a subscription
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "subscriptions:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;
  const today = new Date().toISOString().split("T")[0];

  try {
    const body: AssignmentRequest = await request.json();

    // Validate request
    if (!body.subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    if (!body.recurringService) {
      return NextResponse.json(
        { error: "Recurring service details are required" },
        { status: 400 }
      );
    }

    if (!body.recurringService.startDate || !body.recurringService.techId) {
      return NextResponse.json(
        { error: "Start date and tech are required for recurring service" },
        { status: 400 }
      );
    }

    if (
      !body.recurringService.serviceDays ||
      body.recurringService.serviceDays.length === 0
    ) {
      return NextResponse.json(
        { error: "At least one service day is required" },
        { status: 400 }
      );
    }

    // Verify subscription belongs to org
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*, location:locations(*), client:clients(*)")
      .eq("id", body.subscriptionId)
      .eq("org_id", orgId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    let initialCleanupJob = null;
    let recurringJobsUpdated = 0;

    // Create initial cleanup job if specified
    if (body.initialCleanup) {
      const { date, techId, estimatedMinutes } = body.initialCleanup;

      // Validate initial cleanup tech
      if (!techId) {
        return NextResponse.json(
          { error: "Tech is required for initial cleanup" },
          { status: 400 }
        );
      }

      // Find or create route for the initial cleanup date
      const routeId = await findOrCreateRoute(supabase, orgId, techId, date);

      // Create the initial cleanup job
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          org_id: orgId,
          subscription_id: subscription.id,
          client_id: subscription.client_id,
          location_id: subscription.location_id,
          assigned_to: techId,
          route_id: routeId,
          scheduled_date: date,
          status: "SCHEDULED",
          duration_minutes: estimatedMinutes || 30,
          price_cents: subscription.price_per_visit_cents || 0,
          metadata: {
            is_initial_cleanup: true,
            generated_by: "assignment_modal",
            generated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (jobError) {
        console.error("Error creating initial cleanup job:", jobError);
        return NextResponse.json(
          { error: "Failed to create initial cleanup job" },
          { status: 500 }
        );
      }

      initialCleanupJob = job;

      // Mark initial cleanup as scheduled (not completed yet)
      // The initial_cleanup_completed stays false until the job is completed
    }

    // Update subscription with preferred_day
    // Note: subscriptions table doesn't have assigned_to column
    // Tech assignment is done at the job/route level
    const { serviceDays, techId: recurringTechId } = body.recurringService;
    const primaryDay = serviceDays[0];

    await supabase
      .from("subscriptions")
      .update({
        preferred_day: primaryDay,
      })
      .eq("id", subscription.id);

    // Update all future scheduled jobs with tech and route assignment
    const { data: scheduledJobs } = await supabase
      .from("jobs")
      .select("id, scheduled_date")
      .eq("subscription_id", subscription.id)
      .eq("org_id", orgId)
      .eq("status", "SCHEDULED")
      .gte("scheduled_date", today)
      .is("route_id", null);

    if (scheduledJobs && scheduledJobs.length > 0) {
      for (const job of scheduledJobs) {
        // Find or create route for this job's date
        const routeId = await findOrCreateRoute(
          supabase,
          orgId,
          recurringTechId,
          job.scheduled_date
        );

        // Update the job with tech and route
        const { error: updateError } = await supabase
          .from("jobs")
          .update({
            assigned_to: recurringTechId,
            route_id: routeId,
            duration_minutes: body.recurringService.estimatedMinutes || 15,
          })
          .eq("id", job.id);

        if (!updateError) {
          recurringJobsUpdated++;
        }
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      org_id: orgId,
      user_id: auth.user.id,
      action: "subscription_assigned",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: {
        subscription_id: subscription.id,
        client_name: `${subscription.client?.first_name || ""} ${subscription.client?.last_name || ""}`.trim(),
        initial_cleanup_created: !!initialCleanupJob,
        recurring_jobs_updated: recurringJobsUpdated,
      },
    });

    return NextResponse.json({
      success: true,
      initialCleanupJob,
      recurringJobsUpdated,
      subscription: {
        id: subscription.id,
        preferredDay: primaryDay,
      },
    });
  } catch (error) {
    console.error("Error in assignment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
