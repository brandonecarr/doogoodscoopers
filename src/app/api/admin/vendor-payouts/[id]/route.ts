/**
 * Admin Vendor Payout Detail API
 *
 * GET full payout detail with line items.
 * Requires vendors:read.
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

/**
 * GET /api/admin/vendor-payouts/[id]
 * Get payout detail with line items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "vendors:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: payout, error } = await supabase
    .from("vendor_payouts")
    .select("*, vendor:vendor_id (id, name, payout_method)")
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (error || !payout) {
    return NextResponse.json(
      { error: "Payout not found" },
      { status: 404 }
    );
  }

  // Fetch line items
  const { data: items } = await supabase
    .from("vendor_payout_items")
    .select("*")
    .eq("vendor_payout_id", id)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendor = payout.vendor as any;

  return NextResponse.json({
    payout: {
      id: payout.id,
      vendorId: payout.vendor_id,
      vendorName: vendor?.name ?? null,
      vendorPayoutMethod: vendor?.payout_method ?? null,
      amountCents: payout.amount_cents,
      status: payout.status,
      payoutMethod: payout.payout_method,
      referenceNumber: payout.reference_number,
      periodStart: payout.period_start,
      periodEnd: payout.period_end,
      notes: payout.notes,
      paidAt: payout.paid_at,
      createdAt: payout.created_at,
      updatedAt: payout.updated_at,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (items || []).map((item: any) => ({
      id: item.id,
      jobAddOnId: item.job_add_on_id,
      description: item.description,
      amountCents: item.amount_cents,
      createdAt: item.created_at,
    })),
  });
}
