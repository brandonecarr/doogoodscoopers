/**
 * Change Requests Management API
 *
 * CRUD operations for client change request management.
 * Requires clients:read for GET, clients:write for management.
 *
 * GET /api/admin/change-requests - List all change requests with filters
 * POST /api/admin/change-requests - Create new change request
 * PUT /api/admin/change-requests - Update change request (resolve, dismiss)
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

// Change request statuses
type ChangeRequestStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
const CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"];

// Change request types
const CHANGE_REQUEST_TYPES = [
  "CHANGE_CONTACT_INFO",
  "CHANGE_ADDRESS",
  "CHANGE_SERVICE_DAY",
  "CHANGE_SERVICE_TIME",
  "CHANGE_FREQUENCY",
  "PAUSE_SERVICE",
  "RESUME_SERVICE",
  "CANCEL_SERVICE",
  "ADD_DOG",
  "REMOVE_DOG",
  "UPDATE_DOG_INFO",
  "CHANGE_GATE_CODE",
  "UPDATE_ACCESS_NOTES",
  "CHANGE_BILLING_INFO",
  "CHANGE_PAYMENT_METHOD",
  "REQUEST_EXTRA_CLEANUP",
  "SKIP_NEXT_SERVICE",
  "RESCHEDULE_SERVICE",
  "ADD_LOCATION",
  "REMOVE_LOCATION",
  "CHANGE_TECH_PREFERENCE",
  "OTHER",
] as const;

type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];

function formatRequestType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * GET /api/admin/change-requests
 * List all change requests with filters
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const requestType = searchParams.get("type");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("change_requests")
    .select(
      `
      id,
      request_type,
      status,
      title,
      description,
      current_value,
      requested_value,
      resolution_notes,
      created_at,
      updated_at,
      resolved_at,
      client:client_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      resolved_by_user:resolved_by (
        id,
        first_name,
        last_name
      )
    `,
      { count: "exact" }
    )
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  // Filter by status
  if (status && CHANGE_REQUEST_STATUSES.includes(status as ChangeRequestStatus)) {
    query = query.eq("status", status);
  }

  // Filter by type
  if (requestType && CHANGE_REQUEST_TYPES.includes(requestType as ChangeRequestType)) {
    query = query.eq("request_type", requestType);
  }

  // Filter by client
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: changeRequests, error, count } = await query;

  if (error) {
    console.error("Error fetching change requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch change requests" },
      { status: 500 }
    );
  }

  // Get stats
  const { data: allRequests } = await supabase
    .from("change_requests")
    .select("status, request_type")
    .eq("org_id", auth.user.orgId);

  const stats = {
    total: allRequests?.length || 0,
    open: allRequests?.filter((r) => r.status === "OPEN").length || 0,
    inProgress: allRequests?.filter((r) => r.status === "IN_PROGRESS").length || 0,
    completed: allRequests?.filter((r) => r.status === "COMPLETED").length || 0,
    dismissed: allRequests?.filter((r) => r.status === "DISMISSED").length || 0,
  };

  // Format change requests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedRequests = (changeRequests || []).map((req: any) => ({
    id: req.id,
    requestType: req.request_type,
    requestTypeDisplay: formatRequestType(req.request_type),
    status: req.status,
    title: req.title,
    description: req.description,
    currentValue: req.current_value,
    requestedValue: req.requested_value,
    resolutionNotes: req.resolution_notes,
    createdAt: req.created_at,
    updatedAt: req.updated_at,
    resolvedAt: req.resolved_at,
    client: req.client
      ? {
          id: req.client.id,
          firstName: req.client.first_name,
          lastName: req.client.last_name,
          fullName: `${req.client.first_name || ""} ${req.client.last_name || ""}`.trim(),
          email: req.client.email,
          phone: req.client.phone,
        }
      : null,
    resolvedBy: req.resolved_by_user
      ? {
          id: req.resolved_by_user.id,
          firstName: req.resolved_by_user.first_name,
          lastName: req.resolved_by_user.last_name,
          fullName: `${req.resolved_by_user.first_name || ""} ${req.resolved_by_user.last_name || ""}`.trim(),
        }
      : null,
  }));

  return NextResponse.json({
    changeRequests: formattedRequests,
    stats,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
    requestTypes: CHANGE_REQUEST_TYPES.map((type) => ({
      value: type,
      label: formatRequestType(type),
    })),
  });
}

/**
 * POST /api/admin/change-requests
 * Create a new change request
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { clientId, subscriptionId, requestType, title, description, currentValue, requestedValue } = body;

    if (!clientId || !requestType || !title) {
      return NextResponse.json(
        { error: "Client ID, request type, and title are required" },
        { status: 400 }
      );
    }

    if (!CHANGE_REQUEST_TYPES.includes(requestType)) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Verify client belongs to org
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const { data: changeRequest, error } = await supabase
      .from("change_requests")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        subscription_id: subscriptionId || null,
        request_type: requestType,
        title,
        description: description || null,
        current_value: currentValue || null,
        requested_value: requestedValue || null,
        status: "OPEN",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating change request:", error);
      return NextResponse.json(
        { error: "Failed to create change request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ changeRequest });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/change-requests
 * Update a change request (resolve, dismiss, update status)
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, status, resolutionNotes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Change request ID is required" },
        { status: 400 }
      );
    }

    // Verify change request belongs to org
    const { data: existing, error: checkError } = await supabase
      .from("change_requests")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Change request not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status && CHANGE_REQUEST_STATUSES.includes(status)) {
      updateData.status = status;

      // Set resolved_at and resolved_by when completing or dismissing
      if (status === "COMPLETED" || status === "DISMISSED") {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = auth.user.id;
      }
    }

    if (resolutionNotes !== undefined) {
      updateData.resolution_notes = resolutionNotes;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: changeRequest, error } = await supabase
      .from("change_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating change request:", error);
      return NextResponse.json(
        { error: "Failed to update change request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ changeRequest });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/change-requests
 * Delete a change request
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Change request ID is required" },
      { status: 400 }
    );
  }

  // Verify change request belongs to org
  const { data: existing, error: checkError } = await supabase
    .from("change_requests")
    .select("id")
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (checkError || !existing) {
    return NextResponse.json(
      { error: "Change request not found" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("change_requests")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting change request:", error);
    return NextResponse.json(
      { error: "Failed to delete change request" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
