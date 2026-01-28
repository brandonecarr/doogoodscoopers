/**
 * Admin Schedule API
 *
 * Returns all active subscriptions with their schedule details.
 * Requires clients:read permission.
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
 * GET /api/admin/schedule
 * List all active subscriptions with schedule details
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Filters
  const search = searchParams.get("search");
  const techId = searchParams.get("techId");
  const frequency = searchParams.get("frequency");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = (page - 1) * limit;

  // Build query for subscriptions
  let query = supabase
    .from("subscriptions")
    .select(`
      id,
      status,
      frequency,
      preferred_day,
      price_per_visit_cents,
      created_at,
      client:client_id (
        id,
        first_name,
        last_name,
        phone,
        email,
        status
      ),
      location:location_id (
        id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        latitude,
        longitude
      ),
      assigned_user:assigned_to (
        id,
        first_name,
        last_name
      ),
      plan:plan_id (
        id,
        name,
        frequency
      )
    `, { count: "exact" })
    .eq("org_id", auth.user.orgId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false });

  // Apply tech filter
  if (techId) {
    query = query.eq("assigned_to", techId);
  }

  // Apply frequency filter
  if (frequency) {
    query = query.eq("frequency", frequency);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: subscriptions, error, count } = await query;

  if (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }

  // If search is provided, we need to filter client-side (Supabase doesn't support searching across relations easily)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredSubscriptions: any[] = subscriptions || [];
  if (search) {
    const searchLower = search.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filteredSubscriptions = filteredSubscriptions.filter((sub: any) => {
      const clientName = `${sub.client?.first_name || ""} ${sub.client?.last_name || ""}`.toLowerCase();
      const address = sub.location?.address_line1?.toLowerCase() || "";
      const city = sub.location?.city?.toLowerCase() || "";
      const zip = sub.location?.zip_code?.toLowerCase() || "";
      const locationId = sub.location?.id?.slice(0, 6).toLowerCase() || "";

      return (
        clientName.includes(searchLower) ||
        address.includes(searchLower) ||
        city.includes(searchLower) ||
        zip.includes(searchLower) ||
        locationId.includes(searchLower)
      );
    });
  }

  // Get field techs for filter dropdown
  const { data: techs } = await supabase
    .from("users")
    .select("id, first_name, last_name, role")
    .eq("org_id", auth.user.orgId)
    .in("role", ["FIELD_TECH", "ADMIN", "MANAGER"])
    .eq("status", "ACTIVE")
    .order("first_name", { ascending: true });

  // Format frequency for display
  const formatFrequency = (freq: string | null): string => {
    if (!freq) return "Not set";
    const map: Record<string, string> = {
      WEEKLY: "Once a week",
      BIWEEKLY: "Bi weekly",
      MONTHLY: "Monthly",
      ONE_TIME: "One time",
      TWICE_WEEKLY: "Twice a week",
    };
    return map[freq] || freq;
  };

  // Format the response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedSchedule = filteredSubscriptions.map((sub: any) => ({
    id: sub.id,
    locationId: sub.location?.id?.slice(0, 6) || "N/A",
    clientId: sub.client?.id,
    clientName: sub.client
      ? `${sub.client.first_name || ""} ${sub.client.last_name || ""}`.trim()
      : "Unknown",
    clientFirstName: sub.client?.first_name || "",
    clientLastName: sub.client?.last_name || "",
    address: sub.location?.address_line1 || "",
    addressLine2: sub.location?.address_line2 || "",
    city: sub.location?.city || "",
    state: sub.location?.state || "",
    zipCode: sub.location?.zip_code || "",
    latitude: sub.location?.latitude,
    longitude: sub.location?.longitude,
    assignedTo: sub.assigned_user
      ? `${sub.assigned_user.first_name || ""} ${sub.assigned_user.last_name || ""}`.trim()
      : "Unassigned",
    assignedUserId: sub.assigned_user?.id || null,
    frequency: sub.frequency,
    frequencyDisplay: formatFrequency(sub.frequency),
    preferredDay: sub.preferred_day,
    pricePerVisitCents: sub.price_per_visit_cents,
    planName: sub.plan?.name || null,
    status: sub.status,
    createdAt: sub.created_at,
  }));

  // Format techs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedTechs = (techs || []).map((tech: any) => ({
    id: tech.id,
    fullName: `${tech.first_name || ""} ${tech.last_name || ""}`.trim(),
    firstName: tech.first_name,
    lastName: tech.last_name,
    role: tech.role,
  }));

  return NextResponse.json({
    schedule: formattedSchedule,
    techs: formattedTechs,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

/**
 * PUT /api/admin/schedule
 * Update subscription assignment (Change Tech)
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.subscriptionIds || !Array.isArray(body.subscriptionIds)) {
      return NextResponse.json(
        { error: "subscriptionIds array is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.assignedTo !== undefined) {
      // Verify the user belongs to the org if assigning
      if (body.assignedTo) {
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("id", body.assignedTo)
          .eq("org_id", auth.user.orgId)
          .single();

        if (!user) {
          return NextResponse.json(
            { error: "Invalid tech user" },
            { status: 400 }
          );
        }
      }
      updates.assigned_to = body.assignedTo || null;
    }

    if (body.preferredDay !== undefined) {
      updates.preferred_day = body.preferredDay;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Update subscriptions
    const { data, error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("org_id", auth.user.orgId)
      .in("id", body.subscriptionIds)
      .select("id");

    if (error) {
      console.error("Error updating subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to update subscriptions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
