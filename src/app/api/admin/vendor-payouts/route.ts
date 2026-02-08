/**
 * Admin Vendor Payouts API
 *
 * CRUD operations for vendor payouts.
 * Requires vendors:read for GET, vendors:write for POST/PUT.
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
function formatPayout(p: any) {
  return {
    id: p.id,
    vendorId: p.vendor_id,
    vendorName: p.vendor?.name ?? null,
    amountCents: p.amount_cents,
    status: p.status,
    payoutMethod: p.payout_method,
    referenceNumber: p.reference_number,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    notes: p.notes,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * GET /api/admin/vendor-payouts
 * List vendor payouts. Optional ?vendorId= and ?status= filters.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");
  const status = searchParams.get("status");

  let query = supabase
    .from("vendor_payouts")
    .select("*, vendor:vendor_id (id, name)")
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching vendor payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor payouts" },
      { status: 500 }
    );
  }

  return NextResponse.json({ payouts: (data || []).map(formatPayout) });
}

/**
 * POST /api/admin/vendor-payouts
 * Create a new vendor payout
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const vendorId = body.vendorId ?? body.vendor_id;
    const amountCents = body.amountCents ?? body.amount_cents;
    const periodStart = body.periodStart ?? body.period_start;
    const periodEnd = body.periodEnd ?? body.period_end;

    if (!vendorId || amountCents === undefined || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "vendorId, amountCents, periodStart, and periodEnd are required" },
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

    const { data: payout, error } = await supabase
      .from("vendor_payouts")
      .insert({
        org_id: auth.user.orgId,
        vendor_id: vendorId,
        amount_cents: amountCents,
        status: "PENDING",
        payout_method: body.payoutMethod ?? body.payout_method ?? null,
        reference_number: body.referenceNumber ?? body.reference_number ?? null,
        period_start: periodStart,
        period_end: periodEnd,
        notes: body.notes ?? null,
      })
      .select("*, vendor:vendor_id (id, name)")
      .single();

    if (error) {
      console.error("Error creating vendor payout:", error);
      return NextResponse.json(
        { error: "Failed to create vendor payout" },
        { status: 500 }
      );
    }

    // Create line items if provided
    const items = body.items || [];
    if (items.length > 0) {
      const lineItems = items.map((item: { description: string; amountCents?: number; amount_cents?: number; jobAddOnId?: string; job_add_on_id?: string }) => ({
        org_id: auth.user!.orgId,
        vendor_payout_id: payout.id,
        description: item.description,
        amount_cents: item.amountCents ?? item.amount_cents ?? 0,
        job_add_on_id: item.jobAddOnId ?? item.job_add_on_id ?? null,
      }));

      await supabase.from("vendor_payout_items").insert(lineItems);
    }

    return NextResponse.json({ payout: formatPayout(payout) }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor payout:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/vendor-payouts
 * Update a vendor payout (e.g., mark as paid, update reference)
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
        { error: "Payout ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("vendor_payouts")
      .select("id, status")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor payout not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    const status = body.status;
    if (status !== undefined) {
      const validStatuses = ["PENDING", "PAID", "CANCELED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updates.status = status;
      if (status === "PAID") {
        updates.paid_at = new Date().toISOString();
      }
    }

    const amountCents = body.amountCents ?? body.amount_cents;
    if (amountCents !== undefined) updates.amount_cents = amountCents;

    const payoutMethod = body.payoutMethod ?? body.payout_method;
    if (payoutMethod !== undefined) updates.payout_method = payoutMethod;

    const referenceNumber = body.referenceNumber ?? body.reference_number;
    if (referenceNumber !== undefined) updates.reference_number = referenceNumber;

    if (body.notes !== undefined) updates.notes = body.notes;

    const { data: payout, error } = await supabase
      .from("vendor_payouts")
      .update(updates)
      .eq("id", body.id)
      .select("*, vendor:vendor_id (id, name)")
      .single();

    if (error) {
      console.error("Error updating vendor payout:", error);
      return NextResponse.json(
        { error: "Failed to update vendor payout" },
        { status: 500 }
      );
    }

    return NextResponse.json({ payout: formatPayout(payout) });
  } catch (error) {
    console.error("Error updating vendor payout:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
