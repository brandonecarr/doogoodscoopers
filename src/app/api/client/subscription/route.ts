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

    // Get ALL subscriptions (not just active)
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select(`
        id,
        status,
        frequency,
        price_per_visit_cents,
        preferred_day,
        next_service_date,
        pause_start_date,
        pause_end_date,
        canceled_at,
        cancel_reason,
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
      .order("created_at", { ascending: false });

    // Get add-ons for each subscription
    const subscriptionIds = (subscriptions || []).map((s) => s.id);
    const { data: allAddOns } = subscriptionIds.length > 0
      ? await supabase
          .from("subscription_add_ons")
          .select(`
            id,
            subscription_id,
            quantity,
            price_cents,
            add_on:add_on_id (
              id,
              name,
              price_cents
            )
          `)
          .in("subscription_id", subscriptionIds)
      : { data: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (subscriptions || []).map((sub: any) => ({
      id: sub.id,
      status: sub.status,
      frequency: sub.frequency,
      pricePerVisit: sub.price_per_visit_cents,
      preferredDay: sub.preferred_day,
      nextServiceDate: sub.next_service_date,
      pauseStartDate: sub.pause_start_date,
      pauseEndDate: sub.pause_end_date,
      canceledAt: sub.canceled_at,
      cancelReason: sub.cancel_reason,
      createdAt: sub.created_at,
      plan: sub.plan
        ? { id: sub.plan.id, name: sub.plan.name }
        : null,
      location: sub.location
        ? {
            id: sub.location.id,
            addressLine1: sub.location.address_line1,
            city: sub.location.city,
            state: sub.location.state,
            zipCode: sub.location.zip_code,
          }
        : null,
      addOns: (allAddOns || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((ao: any) => ao.subscription_id === sub.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ao: any) => ({
          id: ao.id,
          name: ao.add_on?.name,
          priceCents: ao.price_cents,
          quantity: ao.quantity,
        })),
    }));

    return NextResponse.json({ subscriptions: result });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
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
    const { action, subscriptionId, pauseUntil, reason, frequency } = body;

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

    // Get the subscription (verify ownership)
    const query = supabase
      .from("subscriptions")
      .select("id, status")
      .eq("client_id", client.id);

    if (subscriptionId) {
      query.eq("id", subscriptionId);
    } else {
      query.in("status", ["ACTIVE", "PAUSED"]);
    }

    const { data: subscription } = await query.single();

    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
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
            pause_start_date: new Date().toISOString().split("T")[0],
            pause_end_date: pauseUntil,
          })
          .eq("id", subscription.id);

        if (pauseError) {
          return NextResponse.json({ error: "Failed to pause subscription" }, { status: 500 });
        }

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
            pause_start_date: null,
            pause_end_date: null,
          })
          .eq("id", subscription.id);

        if (resumeError) {
          return NextResponse.json({ error: "Failed to resume subscription" }, { status: 500 });
        }

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
            status: "CANCELED",
            canceled_at: new Date().toISOString(),
            cancel_reason: reason || null,
          })
          .eq("id", subscription.id);

        if (cancelError) {
          return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
        }

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
          message: "Subscription has been canceled.",
        });
      }

      case "changeFrequency": {
        if (!frequency || !["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(frequency)) {
          return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
        }

        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("frequency")
          .eq("id", subscription.id)
          .single();

        const oldFrequency = currentSub?.frequency;

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

        return NextResponse.json({
          success: true,
          message: `Frequency changed to ${freqLabels[frequency] || frequency}. This will take effect on your next billing cycle.`,
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
