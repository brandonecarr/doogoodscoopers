/**
 * Client Cross-Sells API
 *
 * GET /api/admin/clients/[id]/cross-sells - List cross-sells for a client
 * POST /api/admin/clients/[id]/cross-sells - Add a cross-sell to a client
 * PUT /api/admin/clients/[id]/cross-sells - Update a client cross-sell (e.g. assign vendor)
 * DELETE /api/admin/clients/[id]/cross-sells - Remove a client cross-sell
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatRow(r: any) {
  return {
    id: r.id,
    clientId: r.client_id,
    crossSellId: r.cross_sell_id,
    crossSellType: r.cross_sell_type,
    name: r.name,
    description: r.description,
    unit: r.unit,
    pricePerUnitCents: r.price_per_unit_cents,
    quantity: r.quantity,
    vendorId: r.vendor_id,
    vendorName: r.vendor?.name ?? null,
    vendorCostCents: r.vendor_cost_cents,
    status: r.status,
    notes: r.notes,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * GET /api/admin/clients/[id]/cross-sells
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:read");
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

  const { data, error } = await supabase
    .from("client_cross_sells")
    .select(`
      *,
      vendor:vendor_id (id, name)
    `)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching client cross-sells:", error);
    return NextResponse.json(
      { error: "Failed to fetch client cross-sells" },
      { status: 500 }
    );
  }

  return NextResponse.json({ crossSells: (data || []).map(formatRow) });
}

/**
 * POST /api/admin/clients/[id]/cross-sells
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;

  try {
    const body = await request.json();

    const crossSellId = body.crossSellId ?? body.cross_sell_id;
    const name = body.name;
    const pricePerUnitCents = body.pricePerUnitCents ?? body.price_per_unit_cents;

    if (!crossSellId || !name || pricePerUnitCents === undefined) {
      return NextResponse.json(
        { error: "crossSellId, name, and pricePerUnitCents are required" },
        { status: 400 }
      );
    }

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

    const { data: row, error } = await supabase
      .from("client_cross_sells")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        cross_sell_id: crossSellId,
        cross_sell_type: body.crossSellType ?? body.cross_sell_type ?? "RESIDENTIAL",
        name,
        description: body.description ?? null,
        unit: body.unit ?? null,
        price_per_unit_cents: pricePerUnitCents,
        quantity: body.quantity ?? 1,
        vendor_id: body.vendorId ?? body.vendor_id ?? null,
        vendor_cost_cents: body.vendorCostCents ?? body.vendor_cost_cents ?? null,
        notes: body.notes ?? null,
        is_active: true,
      })
      .select(`
        *,
        vendor:vendor_id (id, name)
      `)
      .single();

    if (error) {
      console.error("Error creating client cross-sell:", error);
      return NextResponse.json(
        { error: "Failed to add cross-sell" },
        { status: 500 }
      );
    }

    return NextResponse.json({ crossSell: formatRow(row) }, { status: 201 });
  } catch (error) {
    console.error("Error creating client cross-sell:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/clients/[id]/cross-sells
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Cross-sell assignment ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify record belongs to this client and org
    const { data: existing } = await supabase
      .from("client_cross_sells")
      .select("id, org_id, client_id")
      .eq("id", body.id)
      .single();

    if (!existing || existing.org_id !== auth.user.orgId || existing.client_id !== clientId) {
      return NextResponse.json(
        { error: "Client cross-sell not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.status !== undefined) updates.status = body.status;

    // Vendor assignment
    const vendorId = body.vendorId ?? body.vendor_id;
    if (vendorId !== undefined) updates.vendor_id = vendorId || null;

    const vendorCostCents = body.vendorCostCents ?? body.vendor_cost_cents;
    if (vendorCostCents !== undefined) updates.vendor_cost_cents = vendorCostCents;

    const isActive = body.isActive ?? body.is_active;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: row, error } = await supabase
      .from("client_cross_sells")
      .update(updates)
      .eq("id", body.id)
      .select(`
        *,
        vendor:vendor_id (id, name)
      `)
      .single();

    if (error) {
      console.error("Error updating client cross-sell:", error);
      return NextResponse.json(
        { error: "Failed to update cross-sell" },
        { status: 500 }
      );
    }

    return NextResponse.json({ crossSell: formatRow(row) });
  } catch (error) {
    console.error("Error updating client cross-sell:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]/cross-sells
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const crossSellRowId = searchParams.get("id");

    if (!crossSellRowId) {
      return NextResponse.json(
        { error: "Cross-sell assignment ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("client_cross_sells")
      .select("id, org_id, client_id")
      .eq("id", crossSellRowId)
      .single();

    if (!existing || existing.org_id !== auth.user.orgId || existing.client_id !== clientId) {
      return NextResponse.json(
        { error: "Client cross-sell not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("client_cross_sells")
      .delete()
      .eq("id", crossSellRowId);

    if (error) {
      console.error("Error deleting client cross-sell:", error);
      return NextResponse.json(
        { error: "Failed to remove cross-sell" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client cross-sell:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
