/**
 * Client Profile API
 *
 * Get and update client profile, locations, and dogs.
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
    // Get client with locations and dogs
    const { data: client } = await supabase
      .from("clients")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        notification_preferences,
        referral_code,
        account_credit_cents,
        created_at
      `)
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get locations
    const { data: locations } = await supabase
      .from("locations")
      .select(`
        id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        is_active,
        gate_code,
        access_notes,
        lat,
        lng
      `)
      .eq("client_id", client.id)
      .eq("is_active", true);

    // Get dogs
    const { data: dogs } = await supabase
      .from("dogs")
      .select(`
        id,
        name,
        breed,
        is_safe,
        safety_notes,
        is_active
      `)
      .eq("client_id", client.id)
      .eq("is_active", true);

    // Get subscription
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
        plan:plan_id (
          id,
          name
        )
      `)
      .eq("client_id", client.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .single();

    return NextResponse.json({
      profile: {
        id: client.id,
        firstName: client.first_name,
        lastName: client.last_name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        notificationPreferences: client.notification_preferences || {
          sms: true,
          email: true,
          dayAhead: true,
          onTheWay: true,
          completed: true,
        },
        referralCode: client.referral_code,
        accountCredit: client.account_credit_cents || 0,
        memberSince: client.created_at,
      },
      locations: (locations || []).map((loc) => ({
        id: loc.id,
        addressLine1: loc.address_line1,
        addressLine2: loc.address_line2,
        city: loc.city,
        state: loc.state,
        zipCode: loc.zip_code,
        gateCode: loc.gate_code,
        accessNotes: loc.access_notes,
        hasCoordinates: !!(loc.lat && loc.lng),
      })),
      dogs: (dogs || []).map((dog) => ({
        id: dog.id,
        name: dog.name,
        breed: dog.breed,
        isSafe: dog.is_safe,
        safetyNotes: dog.safety_notes,
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            frequency: subscription.frequency,
            pricePerVisit: subscription.price_per_visit_cents,
            preferredDay: subscription.preferred_day,
            nextServiceDate: subscription.next_service_date,
            pausedUntil: subscription.paused_until,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            planName: (subscription.plan as any)?.name,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build update object (only allowed fields)
    const updates: Record<string, unknown> = {};

    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.notificationPreferences !== undefined) {
      updates.notification_preferences = body.notificationPreferences;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", client.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Profile updated" });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
