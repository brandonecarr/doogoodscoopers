/**
 * Field Location API
 *
 * Allows field technicians to report their GPS location.
 * This is used for real-time tracking on the dispatch board.
 *
 * POST /api/field/location - Report current location
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

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
 * POST /api/field/location
 * Report the field tech's current location
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  // Only field techs, crew leads, and above can report location
  const allowedRoles = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];
  if (!allowedRoles.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized to report location" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required as numbers" },
        { status: 400 }
      );
    }

    // Validate lat/lng ranges
    if (body.lat < -90 || body.lat > 90) {
      return NextResponse.json(
        { error: "lat must be between -90 and 90" },
        { status: 400 }
      );
    }

    if (body.lng < -180 || body.lng > 180) {
      return NextResponse.json(
        { error: "lng must be between -180 and 180" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Insert location record
    const { data: location, error } = await supabase
      .from("staff_locations")
      .insert({
        org_id: auth.user.orgId,
        user_id: auth.user.id,
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy || null,
        heading: body.heading || null,
        speed: body.speed || null,
        altitude: body.altitude || null,
        recorded_at: body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString(),
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting location:", error);
      return NextResponse.json(
        { error: "Failed to record location" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      location: {
        id: location.id,
        lat: location.lat,
        lng: location.lng,
        recorded_at: location.recorded_at,
      },
    });
  } catch (error) {
    console.error("Error processing location:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/field/location
 * Get the current user's last known location
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  // Get the user's most recent location
  const { data: location, error } = await supabase
    .from("staff_locations")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 }
    );
  }

  if (!location) {
    return NextResponse.json({
      location: null,
      message: "No location recorded yet",
    });
  }

  // Check if location is stale (older than 5 minutes)
  const isStale =
    new Date(location.recorded_at).getTime() < Date.now() - 5 * 60 * 1000;

  return NextResponse.json({
    location: {
      ...location,
      is_stale: isStale,
    },
  });
}
