/**
 * Admin Add-On Vendor Links API
 *
 * CRUD operations for linking add-ons to vendors (many-to-many).
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
function formatLink(l: any) {
  return {
    id: l.id,
    addOnId: l.add_on_id,
    addOnName: l.add_on?.name ?? null,
    addOnPriceCents: l.add_on?.price_cents ?? null,
    vendorId: l.vendor_id,
    vendorName: l.vendor?.name ?? null,
    vendorServiceId: l.vendor_service_id,
    vendorServiceName: l.vendor_service?.name ?? null,
    vendorCostCents: l.vendor_cost_cents,
    isDefault: l.is_default,
    serviceAreaNotes: l.service_area_notes,
    isActive: l.is_active,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

/**
 * GET /api/admin/add-on-vendor-links
 * List vendor links. Optional ?addOnId= or ?vendorId= filter.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const addOnId = searchParams.get("addOnId");
  const vendorId = searchParams.get("vendorId");
  const activeOnly = searchParams.get("active") === "true";

  let query = supabase
    .from("add_on_vendor_links")
    .select(`
      *,
      add_on:add_on_id (id, name, price_cents),
      vendor:vendor_id (id, name),
      vendor_service:vendor_service_id (id, name)
    `)
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  if (addOnId) query = query.eq("add_on_id", addOnId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching add-on vendor links:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor links" },
      { status: 500 }
    );
  }

  return NextResponse.json({ links: (data || []).map(formatLink) });
}

/**
 * POST /api/admin/add-on-vendor-links
 * Create a new add-on vendor link
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const addOnId = body.addOnId ?? body.add_on_id;
    const vendorId = body.vendorId ?? body.vendor_id;
    const vendorCostCents = body.vendorCostCents ?? body.vendor_cost_cents;

    if (!addOnId || !vendorId || vendorCostCents === undefined) {
      return NextResponse.json(
        { error: "addOnId, vendorId, and vendorCostCents are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify add-on and vendor belong to org
    const [addOnRes, vendorRes] = await Promise.all([
      supabase.from("add_ons").select("id").eq("id", addOnId).eq("org_id", auth.user.orgId).single(),
      supabase.from("vendors").select("id").eq("id", vendorId).eq("org_id", auth.user.orgId).single(),
    ]);

    if (!addOnRes.data) {
      return NextResponse.json({ error: "Add-on not found" }, { status: 404 });
    }
    if (!vendorRes.data) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const vendorServiceId = body.vendorServiceId ?? body.vendor_service_id ?? null;

    const { data: link, error } = await supabase
      .from("add_on_vendor_links")
      .insert({
        org_id: auth.user.orgId,
        add_on_id: addOnId,
        vendor_id: vendorId,
        vendor_service_id: vendorServiceId,
        vendor_cost_cents: vendorCostCents,
        is_default: body.isDefault ?? body.is_default ?? false,
        service_area_notes: body.serviceAreaNotes ?? body.service_area_notes ?? null,
        is_active: body.isActive ?? body.is_active ?? true,
      })
      .select(`
        *,
        add_on:add_on_id (id, name, price_cents),
        vendor:vendor_id (id, name),
        vendor_service:vendor_service_id (id, name)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This vendor is already linked to this add-on" },
          { status: 409 }
        );
      }
      console.error("Error creating vendor link:", error);
      return NextResponse.json(
        { error: "Failed to create vendor link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ link: formatLink(link) }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor link:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/add-on-vendor-links
 * Update a vendor link
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
        { error: "Link ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("add_on_vendor_links")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor link not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    const vendorServiceId = body.vendorServiceId ?? body.vendor_service_id;
    if (vendorServiceId !== undefined) updates.vendor_service_id = vendorServiceId;

    const vendorCostCents = body.vendorCostCents ?? body.vendor_cost_cents;
    if (vendorCostCents !== undefined) updates.vendor_cost_cents = vendorCostCents;

    const isDefault = body.isDefault ?? body.is_default;
    if (isDefault !== undefined) updates.is_default = isDefault;

    const serviceAreaNotes = body.serviceAreaNotes ?? body.service_area_notes;
    if (serviceAreaNotes !== undefined) updates.service_area_notes = serviceAreaNotes;

    const isActive = body.isActive ?? body.is_active;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: link, error } = await supabase
      .from("add_on_vendor_links")
      .update(updates)
      .eq("id", body.id)
      .select(`
        *,
        add_on:add_on_id (id, name, price_cents),
        vendor:vendor_id (id, name),
        vendor_service:vendor_service_id (id, name)
      `)
      .single();

    if (error) {
      console.error("Error updating vendor link:", error);
      return NextResponse.json(
        { error: "Failed to update vendor link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ link: formatLink(link) });
  } catch (error) {
    console.error("Error updating vendor link:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/add-on-vendor-links
 * Delete a vendor link (hard delete since it's a join record)
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
        { error: "Link ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("add_on_vendor_links")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor link not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("add_on_vendor_links")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting vendor link:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor link:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
