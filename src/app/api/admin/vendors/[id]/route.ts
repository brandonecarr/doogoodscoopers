/**
 * Admin Vendor Detail API
 *
 * GET full vendor profile with services, add-on links, and payouts.
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
 * GET /api/admin/vendors/[id]
 * Get full vendor profile with services, linked add-ons, and recent payouts
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

  // Fetch vendor
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (vendorError || !vendor) {
    return NextResponse.json(
      { error: "Vendor not found" },
      { status: 404 }
    );
  }

  // Fetch services, links, and recent payouts in parallel
  const [servicesRes, linksRes, payoutsRes] = await Promise.all([
    supabase
      .from("vendor_services")
      .select("*")
      .eq("vendor_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("add_on_vendor_links")
      .select(`
        *,
        add_on:add_on_id (id, name, price_cents),
        vendor_service:vendor_service_id (id, name)
      `)
      .eq("vendor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vendor_payouts")
      .select("*")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services = (servicesRes.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    vendorCostCents: s.vendor_cost_cents,
    costType: s.cost_type,
    isActive: s.is_active,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addOnLinks = (linksRes.data || []).map((l: any) => ({
    id: l.id,
    addOnId: l.add_on_id,
    addOnName: l.add_on?.name ?? null,
    addOnPriceCents: l.add_on?.price_cents ?? null,
    vendorServiceId: l.vendor_service_id,
    vendorServiceName: l.vendor_service?.name ?? null,
    vendorCostCents: l.vendor_cost_cents,
    isDefault: l.is_default,
    serviceAreaNotes: l.service_area_notes,
    isActive: l.is_active,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payouts = (payoutsRes.data || []).map((p: any) => ({
    id: p.id,
    amountCents: p.amount_cents,
    status: p.status,
    payoutMethod: p.payout_method,
    referenceNumber: p.reference_number,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    notes: p.notes,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }));

  return NextResponse.json({
    vendor: {
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contact_name,
      email: vendor.email,
      phone: vendor.phone,
      website: vendor.website,
      address: vendor.address,
      payoutMethod: vendor.payout_method,
      payoutDetails: vendor.payout_details,
      commissionType: vendor.commission_type,
      commissionValue: vendor.commission_value,
      notes: vendor.notes,
      isActive: vendor.is_active,
      createdAt: vendor.created_at,
      updatedAt: vendor.updated_at,
    },
    services,
    addOnLinks,
    payouts,
  });
}
