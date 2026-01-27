/**
 * Route Planner Map Data API
 *
 * Returns all client/location data needed for the route planner map.
 * Supports filtering by day of week and/or tech.
 *
 * Requires routes:read permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import { calculateBounds } from "@/lib/distance-utils";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Tech colors for map pins
const TECH_COLORS = [
  "#EF4444", // red
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

interface MapClient {
  id: string;
  subscriptionId: string;
  clientName: string;
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  serviceDays: string[];
  techId: string | null;
  techName: string;
  subscriptionType: string;
  frequency: string;
  pinNumber: number;
}

interface MapTech {
  id: string;
  name: string;
  color: string;
}

interface MapDataResponse {
  clients: MapClient[];
  techs: MapTech[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
}

/**
 * GET /api/admin/route-planner/map-data
 * Query params:
 *   - day: Filter by service day (MONDAY, TUESDAY, etc.)
 *   - techId: Filter by assigned tech
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const filterDay = searchParams.get("day");
  const filterTechId = searchParams.get("techId");

  try {
    // Get all active subscriptions with locations and clients
    let subscriptionsQuery = supabase
      .from("subscriptions")
      .select(`
        id,
        frequency,
        preferred_day,
        client:clients!inner (
          id,
          first_name,
          last_name,
          company_name
        ),
        location:locations!inner (
          id,
          address_line1,
          city,
          zip_code,
          latitude,
          longitude
        ),
        plan:service_plans (
          name
        )
      `)
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .not("location.latitude", "is", null)
      .not("location.longitude", "is", null);

    // Filter by preferred day if specified
    if (filterDay) {
      subscriptionsQuery = subscriptionsQuery.eq("preferred_day", filterDay);
    }

    const { data: subscriptions, error: subsError } = await subscriptionsQuery;

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return NextResponse.json(
        { error: "Failed to fetch subscription data" },
        { status: 500 }
      );
    }

    // Get tech assignments from recent jobs for each subscription
    // We look at the most recent job to determine who typically services this subscription
    const subscriptionIds = (subscriptions || []).map((s) => s.id);

    let techAssignments: Record<string, string> = {};
    if (subscriptionIds.length > 0) {
      const { data: recentJobs } = await supabase
        .from("jobs")
        .select("subscription_id, assigned_to")
        .in("subscription_id", subscriptionIds)
        .not("assigned_to", "is", null)
        .order("scheduled_date", { ascending: false });

      // Build a map of subscription -> tech
      if (recentJobs) {
        for (const job of recentJobs) {
          if (job.subscription_id && job.assigned_to && !techAssignments[job.subscription_id]) {
            techAssignments[job.subscription_id] = job.assigned_to;
          }
        }
      }
    }

    // Get all field techs for the org
    const { data: techUsers } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .eq("org_id", orgId)
      .in("role", ["FIELD_TECH", "CREW_LEAD"])
      .eq("is_active", true);

    // Build tech map with colors
    const techMap: Record<string, MapTech> = {};
    const techs: MapTech[] = [];
    (techUsers || []).forEach((tech, index) => {
      const mapTech: MapTech = {
        id: tech.id,
        name: `${tech.first_name || ""} ${tech.last_name || ""}`.trim() || "Unknown",
        color: TECH_COLORS[index % TECH_COLORS.length],
      };
      techMap[tech.id] = mapTech;
      techs.push(mapTech);
    });

    // Filter by tech if specified
    let filteredSubscriptions = subscriptions || [];
    if (filterTechId) {
      filteredSubscriptions = filteredSubscriptions.filter(
        (sub) => techAssignments[sub.id] === filterTechId
      );
    }

    // Transform to MapClient format
    const clients: MapClient[] = [];
    let pinNumber = 1;

    for (const sub of filteredSubscriptions) {
      const client = sub.client as unknown as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
      };
      const location = sub.location as unknown as {
        id: string;
        address_line1: string;
        city: string;
        zip_code: string;
        latitude: number;
        longitude: number;
      };
      const plan = sub.plan as unknown as { name: string } | null;

      // Build client name
      let clientName = "";
      if (client.company_name) {
        clientName = client.company_name;
      } else if (client.first_name || client.last_name) {
        clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
      }

      // Get assigned tech
      const assignedTechId = techAssignments[sub.id] || null;
      const assignedTech = assignedTechId ? techMap[assignedTechId] : null;

      // Determine service days
      const serviceDays: string[] = [];
      if (sub.preferred_day) {
        serviceDays.push(sub.preferred_day);
      }

      clients.push({
        id: client.id,
        subscriptionId: sub.id,
        clientName,
        address: location.address_line1,
        city: location.city,
        zipCode: location.zip_code,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        serviceDays,
        techId: assignedTechId,
        techName: assignedTech?.name || "Unassigned",
        subscriptionType: plan?.name || sub.frequency,
        frequency: sub.frequency,
        pinNumber: pinNumber++,
      });
    }

    // Calculate map bounds
    const coordinates = clients.map((c) => ({
      latitude: c.latitude,
      longitude: c.longitude,
    }));
    const bounds = calculateBounds(coordinates);

    const response: MapDataResponse = {
      clients,
      techs,
      bounds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in map data API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
