/**
 * Admin Vendor Services API
 *
 * CRUD operations for vendor service offerings.
 * Requires vendors:read for GET, vendors:write for POST/PUT/DELETE.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
  errorResponse,
} from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatService(s: any) {
  return {
    id: s.id,
    vendorId: s.vendor_id,
    vendorName: s.vendor?.name ?? null,
    name: s.name,
    description: s.description,
    vendorCostCents: s.vendor_cost_cents,
    costType: s.cost_type,
    isActive: s.is_active,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

/**
 * GET /api/admin/vendor-services
 * List vendor services. Optional ?vendorId= filter.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");
  const activeOnly = searchParams.get("active") === "true";

  let query = supabase
    .from("vendor_services")
    .select("*, vendor:vendor_id (name)")
    .eq("org_id", auth.user.orgId)
    .order("name", { ascending: true });

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }
  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching vendor services:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor services" },
      { status: 500 }
    );
  }

  return NextResponse.json({ services: (data || []).map(formatService) });
}

/**
 * POST /api/admin/vendor-services
 * Create a new vendor service
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const vendorId = body.vendorId ?? body.vendor_id;
    const vendorCostCents = body.vendorCostCents ?? body.vendor_cost_cents;
    const costType = body.costType ?? body.cost_type ?? "FIXED";

    if (!vendorId || !body.name || vendorCostCents === undefined) {
      return NextResponse.json(
        { error: "vendorId, name, and vendorCostCents are required" },
        { status: 400 }
      );
    }

    if (!["FIXED", "PER_VISIT"].includes(costType)) {
      return NextResponse.json(
        { error: "Invalid costType. Must be FIXED or PER_VISIT" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify vendor belongs to org
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", vendorId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const { data: service, error } = await supabase
      .from("vendor_services")
      .insert({
        org_id: auth.user.orgId,
        vendor_id: vendorId,
        name: body.name,
        description: body.description ?? null,
        vendor_cost_cents: vendorCostCents,
        cost_type: costType,
        is_active: body.isActive ?? body.is_active ?? true,
      })
      .select("*, vendor:vendor_id (name)")
      .single();

    if (error) {
      console.error("Error creating vendor service:", error);
      return NextResponse.json(
        { error: "Failed to create vendor service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: formatService(service) }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor service:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/vendor-services
 * Update a vendor service
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("vendor_services")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor service not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    const vendorCostCents = body.vendorCostCents ?? body.vendor_cost_cents;
    if (vendorCostCents !== undefined) updates.vendor_cost_cents = vendorCostCents;

    const costType = body.costType ?? body.cost_type;
    if (costType !== undefined) {
      if (!["FIXED", "PER_VISIT"].includes(costType)) {
        return NextResponse.json(
          { error: "Invalid costType" },
          { status: 400 }
        );
      }
      updates.cost_type = costType;
    }

    const isActive = body.isActive ?? body.is_active;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: service, error } = await supabase
      .from("vendor_services")
      .update(updates)
      .eq("id", body.id)
      .select("*, vendor:vendor_id (name)")
      .single();

    if (error) {
      console.error("Error updating vendor service:", error);
      return NextResponse.json(
        { error: "Failed to update vendor service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: formatService(service) });
  } catch (error) {
    console.error("Error updating vendor service:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/vendor-services
 * Soft delete a vendor service
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("vendor_services")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor service not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("vendor_services")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deleting vendor service:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor service:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
