/**
 * Route Manager Map Data API
 *
 * Returns route data with location coordinates for map visualization.
 * Requires routes:read permission.
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

/**
 * GET /api/admin/routes/map-data?date=YYYY-MM-DD&techId=xxx
 * Returns route data with coordinates for map display
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date");
  const techId = searchParams.get("techId");

  if (!date) {
    return NextResponse.json(
      { error: "date parameter is required" },
      { status: 400 }
    );
  }

  // Build route query
  let routeQuery = supabase
    .from("routes")
    .select(`
      id,
      name,
      status,
      route_date,
      start_time,
      end_time,
      assigned_to,
      assigned_user:assigned_to (
        id,
        first_name,
        last_name
      ),
      stops:route_stops (
        id,
        stop_order,
        estimated_arrival,
        actual_arrival,
        job:job_id (
          id,
          status,
          scheduled_date,
          price_cents,
          notes,
          internal_notes,
          started_at,
          completed_at,
          duration_minutes,
          client:client_id (
            id,
            first_name,
            last_name,
            phone,
            email
          ),
          location:location_id (
            id,
            address_line1,
            address_line2,
            city,
            state,
            zip_code,
            gate_code,
            gate_location,
            access_notes,
            latitude,
            longitude,
            dogs (
              id,
              name,
              is_active
            )
          ),
          subscription:subscription_id (
            id,
            frequency,
            price_per_visit_cents
          )
        )
      )
    `)
    .eq("org_id", auth.user.orgId)
    .eq("route_date", date)
    .order("name", { ascending: true });

  if (techId) {
    routeQuery = routeQuery.eq("assigned_to", techId);
  }

  const { data: routes, error: routesError } = await routeQuery;

  if (routesError) {
    console.error("Error fetching routes:", routesError);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }

  // Get field techs for the dropdown
  const { data: techs } = await supabase
    .from("users")
    .select("id, first_name, last_name, role")
    .eq("org_id", auth.user.orgId)
    .in("role", ["FIELD_TECH", "ADMIN", "MANAGER"])
    .eq("status", "ACTIVE")
    .order("first_name", { ascending: true });

  // Define tech colors for map pins
  const techColors = [
    "#10B981", // emerald
    "#3B82F6", // blue
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#14B8A6", // teal
    "#F97316", // orange
  ];

  // Format routes with coordinates and compute bounds
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let hasCoordinates = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedRoutes = (routes || []).map((route: any, routeIndex: number) => {
    const techColor = techColors[routeIndex % techColors.length];

    // Sort stops by stop_order
    const sortedStops = (route.stops || [])
      .sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((stop: any, stopIndex: number) => {
        const lat = stop.job?.location?.latitude;
        const lng = stop.job?.location?.longitude;

        // Update bounds
        if (lat && lng) {
          hasCoordinates = true;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }

        const activeDogs = stop.job?.location?.dogs?.filter((d: { is_active: boolean }) => d.is_active) || [];

        return {
          id: stop.id,
          stopNumber: stopIndex + 1,
          stopOrder: stop.stop_order,
          estimatedArrival: stop.estimated_arrival,
          actualArrival: stop.actual_arrival,
          job: stop.job ? {
            id: stop.job.id,
            status: stop.job.status,
            scheduledDate: stop.job.scheduled_date,
            priceCents: stop.job.price_cents,
            notes: stop.job.notes,
            internalNotes: stop.job.internal_notes,
            startedAt: stop.job.started_at,
            completedAt: stop.job.completed_at,
            durationMinutes: stop.job.duration_minutes,
          } : null,
          client: stop.job?.client ? {
            id: stop.job.client.id,
            firstName: stop.job.client.first_name,
            lastName: stop.job.client.last_name,
            fullName: `${stop.job.client.first_name || ""} ${stop.job.client.last_name || ""}`.trim(),
            phone: stop.job.client.phone,
            email: stop.job.client.email,
          } : null,
          location: stop.job?.location ? {
            id: stop.job.location.id,
            addressLine1: stop.job.location.address_line1,
            addressLine2: stop.job.location.address_line2,
            city: stop.job.location.city,
            state: stop.job.location.state,
            zipCode: stop.job.location.zip_code,
            gateCode: stop.job.location.gate_code,
            gateLocation: stop.job.location.gate_location,
            accessNotes: stop.job.location.access_notes,
            latitude: stop.job.location.latitude,
            longitude: stop.job.location.longitude,
          } : null,
          subscription: stop.job?.subscription ? {
            id: stop.job.subscription.id,
            frequency: stop.job.subscription.frequency,
            pricePerVisitCents: stop.job.subscription.price_per_visit_cents,
          } : null,
          dogCount: activeDogs.length,
          dogNames: activeDogs.map((d: { name: string }) => d.name),
        };
      });

    // Calculate route progress
    const totalStops = sortedStops.length;
    const completedStops = sortedStops.filter(
      (s: { job: { status: string } | null }) => s.job?.status === "COMPLETED"
    ).length;
    const inProgressStops = sortedStops.filter(
      (s: { job: { status: string } | null }) => s.job?.status === "IN_PROGRESS"
    ).length;

    return {
      id: route.id,
      name: route.name || `Route ${route.id.slice(0, 8)}`,
      status: route.status,
      routeDate: route.route_date,
      startTime: route.start_time,
      endTime: route.end_time,
      assignedTo: route.assigned_to,
      assignedUser: route.assigned_user ? {
        id: route.assigned_user.id,
        firstName: route.assigned_user.first_name,
        lastName: route.assigned_user.last_name,
        fullName: `${route.assigned_user.first_name || ""} ${route.assigned_user.last_name || ""}`.trim(),
      } : null,
      color: techColor,
      stops: sortedStops,
      progress: {
        total: totalStops,
        completed: completedStops,
        inProgress: inProgressStops,
        percentage: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
      },
    };
  });

  // Format techs with colors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedTechs = (techs || []).map((tech: any, index: number) => ({
    id: tech.id,
    firstName: tech.first_name,
    lastName: tech.last_name,
    fullName: `${tech.first_name || ""} ${tech.last_name || ""}`.trim(),
    role: tech.role,
    color: techColors[index % techColors.length],
  }));

  // Calculate bounds with padding
  const bounds = hasCoordinates ? {
    north: maxLat + 0.01,
    south: minLat - 0.01,
    east: maxLng + 0.01,
    west: minLng - 0.01,
  } : null;

  return NextResponse.json({
    routes: formattedRoutes,
    techs: formattedTechs,
    bounds,
    summary: {
      totalRoutes: formattedRoutes.length,
      totalStops: formattedRoutes.reduce((sum, r) => sum + r.stops.length, 0),
      completedStops: formattedRoutes.reduce((sum, r) => sum + r.progress.completed, 0),
    },
  });
}
