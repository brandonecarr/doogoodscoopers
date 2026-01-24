/**
 * Admin Staff Locations API
 *
 * Get current locations of all field staff for dispatch board.
 * Requires staff:read permission.
 *
 * GET /api/admin/staff-locations - Get all current staff locations
 * GET /api/admin/staff-locations?userId=xxx - Get specific user's location history
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

interface StaffLocation {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  vehicle_type: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
  is_stale: boolean;
  current_route?: {
    id: string;
    name: string | null;
    status: string;
    stops_completed: number;
    total_stops: number;
  } | null;
}

/**
 * GET /api/admin/staff-locations
 * Get current locations of all field staff
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "staff:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get("userId");
  const includeHistory = searchParams.get("history") === "true";
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  // If requesting a specific user's history
  if (userId && includeHistory) {
    const { data: locations, error } = await supabase
      .from("staff_locations")
      .select(`
        id,
        lat,
        lng,
        accuracy,
        heading,
        speed,
        altitude,
        recorded_at,
        metadata
      `)
      .eq("org_id", auth.user.orgId)
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching location history:", error);
      return NextResponse.json(
        { error: "Failed to fetch location history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ locations });
  }

  // Get current location for all staff
  // First, get the most recent location for each user in the org
  const { data: staffWithLocations, error: locError } = await supabase
    .from("users")
    .select(`
      id,
      first_name,
      last_name,
      email,
      role,
      staff_profile:staff_profiles!left (
        vehicle_type
      )
    `)
    .eq("org_id", auth.user.orgId)
    .in("role", ["FIELD_TECH", "CREW_LEAD"]);

  if (locError) {
    console.error("Error fetching staff:", locError);
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    );
  }

  // For each staff member, get their most recent location
  const staffLocations: StaffLocation[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const staff of staffWithLocations || []) {
    // Get most recent location
    const { data: latestLocation } = await supabase
      .from("staff_locations")
      .select("lat, lng, accuracy, heading, speed, recorded_at")
      .eq("user_id", staff.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    // Get current route assignment
    const { data: currentRoute } = await supabase
      .from("routes")
      .select(`
        id,
        name,
        status,
        stops:route_stops (
          id,
          job:job_id (
            status
          )
        )
      `)
      .eq("assigned_to", staff.id)
      .eq("route_date", today)
      .eq("status", "IN_PROGRESS")
      .limit(1)
      .single();

    // Calculate route progress
    let routeInfo = null;
    if (currentRoute) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stops = (currentRoute.stops || []) as any[];
      const totalStops = stops.length;
      const completedStops = stops.filter(
        (s) => s.job?.status === "COMPLETED"
      ).length;

      routeInfo = {
        id: currentRoute.id,
        name: currentRoute.name,
        status: currentRoute.status,
        stops_completed: completedStops,
        total_stops: totalStops,
      };
    }

    if (latestLocation) {
      const isStale =
        new Date(latestLocation.recorded_at).getTime() <
        Date.now() - 5 * 60 * 1000;

      // staff_profile is an array from the join, get first element
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staffProfileArr = staff.staff_profile as any;
      const staffProfile = Array.isArray(staffProfileArr) ? staffProfileArr[0] : staffProfileArr;

      staffLocations.push({
        user_id: staff.id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email,
        vehicle_type: staffProfile?.vehicle_type || null,
        lat: latestLocation.lat,
        lng: latestLocation.lng,
        accuracy: latestLocation.accuracy,
        heading: latestLocation.heading,
        speed: latestLocation.speed,
        recorded_at: latestLocation.recorded_at,
        is_stale: isStale,
        current_route: routeInfo,
      });
    }
  }

  // Sort by most recently updated
  staffLocations.sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  return NextResponse.json({
    locations: staffLocations,
    staff_count: staffWithLocations?.length || 0,
    active_count: staffLocations.filter((l) => !l.is_stale).length,
  });
}
