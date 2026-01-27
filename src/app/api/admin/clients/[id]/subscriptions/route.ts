/**
 * Client Subscriptions API
 *
 * GET /api/admin/clients/[id]/subscriptions - List all subscriptions for a client
 * POST /api/admin/clients/[id]/subscriptions - Create a new subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import { regenerateJobsForSubscription } from "@/lib/subscription-jobs";

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
 * GET /api/admin/clients/[id]/subscriptions
 * List all subscriptions for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Fetch subscriptions with plan details
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plan:service_plans(id, name, frequency, description),
      location:locations(id, street_address, city)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }

  // Format response to camelCase
  const formattedSubscriptions = (subscriptions || []).map((sub) => ({
    id: sub.id,
    status: sub.status,
    frequency: sub.frequency,
    preferredDay: sub.preferred_day,
    pricePerVisitCents: sub.price_per_visit_cents,
    billingDay: sub.billing_day,
    startDate: sub.start_date,
    endDate: sub.end_date,
    nextServiceDate: sub.next_service_date,
    initialCleanupRequired: sub.initial_cleanup_required,
    initialCleanupCompleted: sub.initial_cleanup_completed,
    createdAt: sub.created_at,
    plan: sub.plan ? {
      id: sub.plan.id,
      name: sub.plan.name,
      frequency: sub.plan.frequency,
      description: sub.plan.description,
    } : null,
    location: sub.location ? {
      id: sub.location.id,
      streetAddress: sub.location.street_address,
      city: sub.location.city,
    } : null,
  }));

  return NextResponse.json({ subscriptions: formattedSubscriptions });
}

/**
 * POST /api/admin/clients/[id]/subscriptions
 * Create a new subscription
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      planId,
      locationId,
      startDate,
      endDate,
      billingOption,
      billingInterval,
      couponCode,
      initialCleanupRequired,
      priceOverrideCents,
    } = body;

    // Validate required fields
    if (!planId) {
      return NextResponse.json({ error: "Service plan is required" }, { status: 400 });
    }

    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }

    // Get the service plan
    const { data: plan, error: planError } = await supabase
      .from("service_plans")
      .select("*")
      .eq("id", planId)
      .eq("org_id", auth.user.orgId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Service plan not found" }, { status: 404 });
    }

    // Get location - use provided locationId or get client's primary location
    let location;
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("id, org_id")
        .eq("id", locationId)
        .eq("client_id", clientId)
        .single();
      location = loc;
    } else {
      // Get client's primary or first location
      const { data: locs } = await supabase
        .from("locations")
        .select("id, org_id")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .limit(1);
      location = locs?.[0];
    }

    if (!location) {
      return NextResponse.json(
        { error: "No location found for this client. Please add a location first." },
        { status: 400 }
      );
    }

    // Determine price - use override if provided, otherwise could be from plan or default
    // For now, we'll use a default price structure
    const pricePerVisitCents = priceOverrideCents || 3500; // Default $35 per visit

    // Map billing interval to frequency if different from plan
    let frequency = plan.frequency;
    if (billingInterval) {
      const intervalMap: Record<string, string> = {
        weekly: "WEEKLY",
        biweekly: "BIWEEKLY",
        monthly: "MONTHLY",
      };
      frequency = intervalMap[billingInterval] || plan.frequency;
    }

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        location_id: location.id,
        plan_id: planId,
        status: "ACTIVE",
        frequency,
        price_per_visit_cents: pricePerVisitCents,
        start_date: startDate,
        end_date: endDate || null,
        next_service_date: startDate,
        initial_cleanup_required: initialCleanupRequired || false,
        initial_cleanup_completed: false,
        metadata: {
          billing_option: billingOption || "prepaid-fixed",
          coupon_code: couponCode || null,
          created_by: auth.user.id,
        },
      })
      .select(`
        *,
        plan:service_plans(id, name, frequency, description)
      `)
      .single();

    if (subError) {
      console.error("Error creating subscription:", subError);
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    // Generate jobs for the subscription
    const jobsGenerated = await regenerateJobsForSubscription(
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
      14 // Generate 14 days of jobs
    );

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "SUBSCRIPTION_CREATED",
      entity_type: "SUBSCRIPTION",
      entity_id: subscription.id,
      details: {
        clientId,
        planId,
        planName: plan.name,
        frequency,
        startDate,
        jobsGenerated,
      },
    });

    // Format response to camelCase
    const formattedSubscription = {
      id: subscription.id,
      status: subscription.status,
      frequency: subscription.frequency,
      preferredDay: subscription.preferred_day,
      pricePerVisitCents: subscription.price_per_visit_cents,
      billingDay: subscription.billing_day,
      startDate: subscription.start_date,
      endDate: subscription.end_date,
      nextServiceDate: subscription.next_service_date,
      initialCleanupRequired: subscription.initial_cleanup_required,
      initialCleanupCompleted: subscription.initial_cleanup_completed,
      createdAt: subscription.created_at,
      plan: subscription.plan ? {
        id: subscription.plan.id,
        name: subscription.plan.name,
        frequency: subscription.plan.frequency,
        description: subscription.plan.description,
      } : null,
      jobsGenerated,
    };

    return NextResponse.json({ subscription: formattedSubscription }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
