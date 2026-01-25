/**
 * Field Route API
 *
 * Get today's route with all stops for the authenticated field tech.
 * Returns full stop details including client, location, and dog info.
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

// Allowed roles for field operations
const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

/**
 * GET /api/field/route
 * Get today's route with all stops
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Allow specifying a date (default to today)
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Get the route assigned to this user for the date
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select(`
      id,
      name,
      route_date,
      status,
      start_time,
      end_time,
      notes
    `)
    .eq("assigned_to", auth.user.id)
    .eq("route_date", date)
    .eq("org_id", auth.user.orgId)
    .limit(1)
    .single();

  if (routeError && routeError.code !== "PGRST116") {
    console.error("Error fetching route:", routeError);
    return NextResponse.json(
      { error: "Failed to fetch route" },
      { status: 500 }
    );
  }

  if (!route) {
    return NextResponse.json({
      route: null,
      stops: [],
      stats: { total: 0, completed: 0, skipped: 0, remaining: 0 },
    });
  }

  // Get all stops with full job details
  const { data: stops, error: stopsError } = await supabase
    .from("route_stops")
    .select(`
      id,
      stop_order,
      estimated_arrival,
      actual_arrival,
      job:job_id (
        id,
        status,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        notes,
        internal_notes,
        skip_reason,
        photos,
        started_at,
        completed_at,
        client:client_id (
          id,
          first_name,
          last_name,
          phone,
          email,
          notification_preferences
        ),
        location:location_id (
          id,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          latitude,
          longitude,
          gate_code,
          gate_location,
          access_notes,
          special_instructions
        )
      )
    `)
    .eq("route_id", route.id)
    .order("stop_order", { ascending: true });

  if (stopsError) {
    console.error("Error fetching stops:", stopsError);
    return NextResponse.json(
      { error: "Failed to fetch stops" },
      { status: 500 }
    );
  }

  // Get dog information for each stop's location
  const locationIds = (stops || [])
    .map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = s.job as any;
      return job?.location?.id;
    })
    .filter(Boolean);

  const { data: dogs } = await supabase
    .from("dogs")
    .select(`
      id,
      name,
      breed,
      is_safe,
      safety_notes,
      special_instructions,
      location_id
    `)
    .in("location_id", locationIds.length > 0 ? locationIds : ["00000000-0000-0000-0000-000000000000"]);

  // Group dogs by location
  const dogsByLocation = new Map<string, typeof dogs>();
  (dogs || []).forEach((dog) => {
    const existing = dogsByLocation.get(dog.location_id) || [];
    existing.push(dog);
    dogsByLocation.set(dog.location_id, existing);
  });

  // Format the response
  const formattedStops = (stops || []).map((stop) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = stop.job as any;
    const locationId = job?.location?.id;
    const locationDogs = dogsByLocation.get(locationId) || [];

    return {
      id: stop.id,
      order: stop.stop_order,
      estimatedArrival: stop.estimated_arrival,
      actualArrival: stop.actual_arrival,
      job: job ? {
        id: job.id,
        status: job.status,
        scheduledDate: job.scheduled_date,
        scheduledTimeStart: job.scheduled_time_start,
        scheduledTimeEnd: job.scheduled_time_end,
        notes: job.notes,
        internalNotes: job.internal_notes,
        skipReason: job.skip_reason,
        photos: job.photos || [],
        startedAt: job.started_at,
        completedAt: job.completed_at,
        client: job.client ? {
          id: job.client.id,
          firstName: job.client.first_name,
          lastName: job.client.last_name,
          phone: job.client.phone,
          email: job.client.email,
          notificationPreferences: job.client.notification_preferences,
        } : null,
        location: job.location ? {
          id: job.location.id,
          addressLine1: job.location.address_line1,
          addressLine2: job.location.address_line2,
          city: job.location.city,
          state: job.location.state,
          zipCode: job.location.zip_code,
          lat: job.location.latitude,
          lng: job.location.longitude,
          gateCode: job.location.gate_code,
          gateLocation: job.location.gate_location,
          accessNotes: job.location.access_notes,
          specialInstructions: job.location.special_instructions,
        } : null,
        dogs: locationDogs.map((dog) => ({
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
          isSafe: dog.is_safe,
          safetyNotes: dog.safety_notes,
          specialInstructions: dog.special_instructions,
        })),
      } : null,
    };
  });

  // Calculate stats
  const jobStatuses = formattedStops.map((s) => s.job?.status).filter(Boolean);
  const stats = {
    total: jobStatuses.length,
    completed: jobStatuses.filter((s) => s === "COMPLETED").length,
    skipped: jobStatuses.filter((s) => s === "SKIPPED").length,
    inProgress: jobStatuses.filter((s) => s === "IN_PROGRESS").length,
    enRoute: jobStatuses.filter((s) => s === "EN_ROUTE").length,
    remaining: jobStatuses.filter((s) => s === "SCHEDULED" || s === "EN_ROUTE").length,
  };

  return NextResponse.json({
    route: {
      id: route.id,
      name: route.name,
      date: route.route_date,
      status: route.status,
      startTime: route.start_time,
      endTime: route.end_time,
      notes: route.notes,
    },
    stops: formattedStops,
    stats,
  });
}
