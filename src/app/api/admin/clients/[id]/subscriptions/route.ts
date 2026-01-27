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

// Frequency display labels for generating plan names
const FREQUENCY_LABELS: Record<string, string> = {
  SEVEN_TIMES_A_WEEK: "7x Week",
  SIX_TIMES_A_WEEK: "6x Week",
  FIVE_TIMES_A_WEEK: "5x Week",
  FOUR_TIMES_A_WEEK: "4x Week",
  THREE_TIMES_A_WEEK: "3x Week",
  TWO_TIMES_A_WEEK: "2x Week",
  ONCE_A_WEEK: "1x Week",
  BI_WEEKLY: "Bi-Weekly",
  TWICE_PER_MONTH: "2x Month",
  EVERY_THREE_WEEKS: "Every 3 Weeks",
  EVERY_FOUR_WEEKS: "Every 4 Weeks",
  ONCE_A_MONTH: "1x Month",
  ONE_TIME: "One-Time",
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-Weekly",
  MONTHLY: "Monthly",
  ONETIME: "One-Time",
};

// Map onboarding frequencies to subscription frequencies
const mapToSubscriptionFrequency = (freq: string): string => {
  const mapping: Record<string, string> = {
    SEVEN_TIMES_A_WEEK: "WEEKLY",
    SIX_TIMES_A_WEEK: "WEEKLY",
    FIVE_TIMES_A_WEEK: "WEEKLY",
    FOUR_TIMES_A_WEEK: "WEEKLY",
    THREE_TIMES_A_WEEK: "WEEKLY",
    TWO_TIMES_A_WEEK: "WEEKLY",
    ONCE_A_WEEK: "WEEKLY",
    BI_WEEKLY: "BIWEEKLY",
    TWICE_PER_MONTH: "BIWEEKLY",
    EVERY_THREE_WEEKS: "BIWEEKLY",
    EVERY_FOUR_WEEKS: "MONTHLY",
    ONCE_A_MONTH: "MONTHLY",
    ONE_TIME: "ONETIME",
  };
  return mapping[freq] || freq;
};

/**
 * POST /api/admin/clients/[id]/subscriptions
 * Create a new subscription
 *
 * Supports two modes:
 * 1. Dog-based subscription: servicePlanValue, dogCount, frequency
 * 2. No Dogs mode: isNoDogs, service, priceOverrideCents, frequency
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
      // Common fields
      locationId,
      startDate,
      endDate,
      billingOption,
      billingInterval,
      couponCode,
      initialCleanupRequired,
      // No Dogs mode fields
      isNoDogs,
      service,
      priceOverrideCents,
      // Dog-based mode fields
      servicePlanValue,
      dogCount,
      frequency: requestFrequency,
    } = body;

    // Validate required fields
    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
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

    let subscriptionData: {
      org_id: string;
      client_id: string;
      location_id: string;
      plan_id: string | null;
      status: string;
      frequency: string;
      price_per_visit_cents: number;
      start_date: string;
      end_date: string | null;
      next_service_date: string;
      initial_cleanup_required: boolean;
      initial_cleanup_completed: boolean;
      metadata: Record<string, unknown>;
    };
    let planName: string;

    if (isNoDogs) {
      // No Dogs mode - custom service
      if (!service || !priceOverrideCents || !requestFrequency) {
        return NextResponse.json(
          { error: "Service, price, and frequency are required for No Dogs subscriptions" },
          { status: 400 }
        );
      }

      // Format service name
      const serviceLabels: Record<string, string> = {
        deodorizing: "Deodorizing",
        sanitizing: "Sanitizing",
        "lawn-treatment": "Lawn Treatment",
        other: "Other Service",
      };
      planName = serviceLabels[service] || service;

      subscriptionData = {
        org_id: auth.user.orgId,
        client_id: clientId,
        location_id: location.id,
        plan_id: null, // No service plan for No Dogs mode
        status: "ACTIVE",
        frequency: requestFrequency,
        price_per_visit_cents: priceOverrideCents,
        start_date: startDate,
        end_date: endDate || null,
        next_service_date: startDate,
        initial_cleanup_required: initialCleanupRequired || false,
        initial_cleanup_completed: false,
        metadata: {
          billing_option: billingOption || "prepaid-fixed",
          coupon_code: couponCode || null,
          created_by: auth.user.id,
          is_no_dogs: true,
          service_type: service,
        },
      };
    } else {
      // Dog-based subscription
      if (!servicePlanValue || !requestFrequency) {
        return NextResponse.json(
          { error: "Service plan and frequency are required" },
          { status: 400 }
        );
      }

      // Generate plan name from dog count and frequency
      const freqLabel = FREQUENCY_LABELS[requestFrequency] || requestFrequency;
      planName = dogCount > 0
        ? `${dogCount} Dog${dogCount > 1 ? "s" : ""} ${freqLabel}`
        : freqLabel;

      // Map the onboarding frequency to subscription frequency
      const subscriptionFrequency = mapToSubscriptionFrequency(requestFrequency);

      // Calculate price based on dog count (default $35/dog/visit)
      const pricePerDog = 3500; // $35 in cents
      const calculatedPrice = (dogCount || 1) * pricePerDog;

      subscriptionData = {
        org_id: auth.user.orgId,
        client_id: clientId,
        location_id: location.id,
        plan_id: null, // Dynamic plans don't have a plan_id
        status: "ACTIVE",
        frequency: subscriptionFrequency,
        price_per_visit_cents: priceOverrideCents || calculatedPrice,
        start_date: startDate,
        end_date: endDate || null,
        next_service_date: startDate,
        initial_cleanup_required: initialCleanupRequired || false,
        initial_cleanup_completed: false,
        metadata: {
          billing_option: billingOption || "prepaid-fixed",
          coupon_code: couponCode || null,
          created_by: auth.user.id,
          dog_count: dogCount,
          cleanup_frequency: requestFrequency,
          service_plan_value: servicePlanValue,
        },
      };
    }

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert(subscriptionData)
      .select("*")
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
        planName,
        frequency: subscription.frequency,
        startDate,
        jobsGenerated,
        isNoDogs: isNoDogs || false,
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
      plan: {
        id: null,
        name: planName,
        frequency: subscription.frequency,
        description: null,
      },
      jobsGenerated,
    };

    return NextResponse.json({ subscription: formattedSubscription }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
