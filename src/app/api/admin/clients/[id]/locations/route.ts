/**
 * Client Locations API (Admin)
 *
 * PUT /api/admin/clients/[id]/locations - Update a location
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/clients/[id]/locations
 * Update a location
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { locationId, addressLine1, city, state, zipCode } = body;

    if (!locationId) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    // Verify location belongs to this client
    const { data: existing } = await supabase
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("client_id", clientId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (addressLine1 !== undefined) updates.address_line1 = addressLine1;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (zipCode !== undefined) updates.zip_code = zipCode;

    const { data: updatedLocation, error: updateError } = await supabase
      .from("locations")
      .update(updates)
      .eq("id", locationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating location:", updateError);
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "LOCATION_UPDATED",
      entity_type: "LOCATION",
      entity_id: locationId,
      details: { clientId, updates },
    });

    return NextResponse.json({
      location: {
        id: updatedLocation.id,
        addressLine1: updatedLocation.address_line1,
        addressLine2: updatedLocation.address_line2,
        city: updatedLocation.city,
        state: updatedLocation.state,
        zipCode: updatedLocation.zip_code,
        fullAddress: `${updatedLocation.address_line1}${updatedLocation.address_line2 ? `, ${updatedLocation.address_line2}` : ""}, ${updatedLocation.city}, ${updatedLocation.state} ${updatedLocation.zip_code}`,
        gateCode: updatedLocation.gate_code,
        gateLocation: updatedLocation.gate_location,
        accessNotes: updatedLocation.access_notes,
        lotSize: updatedLocation.lot_size,
        isPrimary: updatedLocation.is_primary,
        isActive: updatedLocation.is_active,
        createdAt: updatedLocation.created_at,
      },
    });
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
