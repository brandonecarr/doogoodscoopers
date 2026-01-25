/**
 * Client Locations API
 *
 * Manage client service locations.
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

/**
 * GET /api/client/locations
 * Get all locations for the authenticated client
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", auth.user.id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: locations, error } = await supabase
    .from("locations")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }

  return NextResponse.json({
    locations: locations.map((loc) => ({
      id: loc.id,
      addressLine1: loc.address_line1,
      addressLine2: loc.address_line2,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zip_code,
      gateCode: loc.gate_code,
      accessNotes: loc.access_notes,
      yardType: loc.yard_type,
      yardSize: loc.yard_size,
    })),
  });
}

/**
 * PUT /api/client/locations
 * Update a location (access notes and gate code only - address changes require staff)
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { locationId, gateCode, accessNotes } = body;

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify location belongs to client
    const { data: location } = await supabase
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("client_id", client.id)
      .single();

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Update only allowed fields
    const { error: updateError } = await supabase
      .from("locations")
      .update({
        gate_code: gateCode ?? null,
        access_notes: accessNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", locationId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }

    return NextResponse.json({ message: "Location updated successfully" });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
