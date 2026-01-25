/**
 * Client Subscription API
 *
 * Manage subscription: pause, resume, request changes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get subscription with details
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(`
        id,
        status,
        frequency,
        price_per_visit_cents,
        preferred_day,
        next_service_date,
        paused_until,
        cancel_at_period_end,
        canceled_at,
        created_at,
        plan:plan_id (
          id,
          name
        ),
        location:location_id (
          id,
          address_line1,
          city,
          state,
          zip_code
        )
      `)
      .eq("client_id", client.id)
      .in("status", ["ACTIVE", "PAUSED", "PENDING_CANCEL"])
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // Get subscription add-ons
    const { data: addOns } = await supabase
      .from("subscription_add_ons")
      .select(`
        id,
        add_on:add_on_id (
          id,
          name,
          price_cents
        )
      `)
      .eq("subscription_id", subscription.id);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        frequency: subscription.frequency,
        pricePerVisit: subscription.price_per_visit_cents,
        preferredDay: subscription.preferred_day,
        nextServiceDate: subscription.next_service_date,
        pausedUntil: subscription.paused_until,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        createdAt: subscription.created_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plan: (subscription.plan as any)
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (subscription.plan as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: (subscription.plan as any).name,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: (subscription.location as any)
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (subscription.location as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              addressLine1: (subscription.location as any).address_line1,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              city: (subscription.location as any).city,
            }
          : null,
        addOns: (addOns || []).map((ao) => ({
          id: ao.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (ao.add_on as any)?.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priceCents: (ao.add_on as any)?.price_cents,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { action, pauseUntil, reason, frequency } = body;

    if (!action) {
      return NextResponse.json({ error: "Action required" }, { status: 400 });
    }

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id, org_id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get active subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("client_id", client.id)
      .in("status", ["ACTIVE", "PAUSED"])
      .single();

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    switch (action) {
      case "pause": {
        if (subscription.status !== "ACTIVE") {
          return NextResponse.json({ error: "Subscription is not active" }, { status: 400 });
        }

        if (!pauseUntil) {
          return NextResponse.json({ error: "Pause end date required" }, { status: 400 });
        }

        const { error: pauseError } = await supabase
          .from("subscriptions")
          .update({
            status: "PAUSED",
            paused_until: pauseUntil,
          })
          .eq("id", subscription.id);

        if (pauseError) {
          return NextResponse.json({ error: "Failed to pause subscription" }, { status: 500 });
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: client.org_id,
          user_id: auth.user.id,
          action: "SUBSCRIPTION_PAUSED",
          entity_type: "SUBSCRIPTION",
          entity_id: subscription.id,
          details: { pauseUntil, reason },
        });

        return NextResponse.json({ success: true, message: "Subscription paused" });
      }

      case "resume": {
        if (subscription.status !== "PAUSED") {
          return NextResponse.json({ error: "Subscription is not paused" }, { status: 400 });
        }

        const { error: resumeError } = await supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            paused_until: null,
          })
          .eq("id", subscription.id);

        if (resumeError) {
          return NextResponse.json({ error: "Failed to resume subscription" }, { status: 500 });
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: client.org_id,
          user_id: auth.user.id,
          action: "SUBSCRIPTION_RESUMED",
          entity_type: "SUBSCRIPTION",
          entity_id: subscription.id,
        });

        return NextResponse.json({ success: true, message: "Subscription resumed" });
      }

      case "cancel": {
        const { error: cancelError } = await supabase
          .from("subscriptions")
          .update({
            status: "PENDING_CANCEL",
            cancel_at_period_end: true,
            canceled_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        if (cancelError) {
          return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: client.org_id,
          user_id: auth.user.id,
          action: "SUBSCRIPTION_CANCEL_REQUESTED",
          entity_type: "SUBSCRIPTION",
          entity_id: subscription.id,
          details: { reason },
        });

        return NextResponse.json({
          success: true,
          message: "Cancellation requested. Service will continue until current period ends.",
        });
      }

      case "changeFrequency": {
        if (!frequency || !["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(frequency)) {
          return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
        }

        // Get the old frequency for logging
        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("frequency")
          .eq("id", subscription.id)
          .single();

        const oldFrequency = currentSub?.frequency;

        // Update the frequency
        const { error: freqError } = await supabase
          .from("subscriptions")
          .update({
            frequency,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        if (freqError) {
          return NextResponse.json({ error: "Failed to change frequency" }, { status: 500 });
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: client.org_id,
          user_id: auth.user.id,
          action: "SUBSCRIPTION_FREQUENCY_CHANGED",
          entity_type: "SUBSCRIPTION",
          entity_id: subscription.id,
          details: { oldFrequency, newFrequency: frequency },
        });

        const freqLabels: Record<string, string> = {
          WEEKLY: "Weekly",
          BIWEEKLY: "Every 2 Weeks",
          MONTHLY: "Monthly",
        };
        const freqLabel = freqLabels[frequency] || frequency;

        return NextResponse.json({
          success: true,
          message: `Frequency changed to ${freqLabel}. This will take effect on your next billing cycle.`,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing subscription:", error);
    return NextResponse.json({ error: "Failed to manage subscription" }, { status: 500 });
  }
}
