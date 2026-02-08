/**
 * Admin Vendors API
 *
 * CRUD operations for vendor management.
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

/**
 * GET /api/admin/vendors
 * List all vendors for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  let query = supabase
    .from("vendors")
    .select("*")
    .eq("org_id", auth.user.orgId)
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data: vendors, error } = await query;

  if (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatted = (vendors || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    contactName: v.contact_name,
    email: v.email,
    phone: v.phone,
    website: v.website,
    address: v.address,
    payoutMethod: v.payout_method,
    payoutDetails: v.payout_details,
    commissionType: v.commission_type,
    commissionValue: v.commission_value,
    notes: v.notes,
    isActive: v.is_active,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  }));

  return NextResponse.json({ vendors: formatted });
}

/**
 * POST /api/admin/vendors
 * Create a new vendor
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "vendors:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Vendor name is required" },
        { status: 400 }
      );
    }

    const payoutMethod = body.payoutMethod ?? body.payout_method ?? "CHECK";
    const validPayoutMethods = ["CHECK", "ACH", "VENMO", "PAYPAL", "OTHER"];
    if (!validPayoutMethods.includes(payoutMethod)) {
      return NextResponse.json(
        { error: "Invalid payout method" },
        { status: 400 }
      );
    }

    const commissionType = body.commissionType ?? body.commission_type ?? "PERCENTAGE";
    const validCommTypes = ["PERCENTAGE", "FIXED_AMOUNT"];
    if (!validCommTypes.includes(commissionType)) {
      return NextResponse.json(
        { error: "Invalid commission type" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({
        org_id: auth.user.orgId,
        name: body.name,
        contact_name: body.contactName ?? body.contact_name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        address: body.address ?? {},
        payout_method: payoutMethod,
        payout_details: body.payoutDetails ?? body.payout_details ?? {},
        commission_type: commissionType,
        commission_value: body.commissionValue ?? body.commission_value ?? 0,
        notes: body.notes ?? null,
        is_active: body.isActive ?? body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating vendor:", error);
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      );
    }

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
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/vendors
 * Update an existing vendor
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
        { error: "Vendor ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.contactName !== undefined || body.contact_name !== undefined)
      updates.contact_name = body.contactName ?? body.contact_name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.website !== undefined) updates.website = body.website;
    if (body.address !== undefined) updates.address = body.address;
    if (body.notes !== undefined) updates.notes = body.notes;

    const payoutMethod = body.payoutMethod ?? body.payout_method;
    if (payoutMethod !== undefined) {
      const validPayoutMethods = ["CHECK", "ACH", "VENMO", "PAYPAL", "OTHER"];
      if (!validPayoutMethods.includes(payoutMethod)) {
        return NextResponse.json(
          { error: "Invalid payout method" },
          { status: 400 }
        );
      }
      updates.payout_method = payoutMethod;
    }

    if (body.payoutDetails !== undefined || body.payout_details !== undefined)
      updates.payout_details = body.payoutDetails ?? body.payout_details;

    const commissionType = body.commissionType ?? body.commission_type;
    if (commissionType !== undefined) {
      const validCommTypes = ["PERCENTAGE", "FIXED_AMOUNT"];
      if (!validCommTypes.includes(commissionType)) {
        return NextResponse.json(
          { error: "Invalid commission type" },
          { status: 400 }
        );
      }
      updates.commission_type = commissionType;
    }

    const commissionValue = body.commissionValue ?? body.commission_value;
    if (commissionValue !== undefined) updates.commission_value = commissionValue;

    const isActive = body.isActive ?? body.is_active;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: vendor, error } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating vendor:", error);
      return NextResponse.json(
        { error: "Failed to update vendor" },
        { status: 500 }
      );
    }

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
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/vendors
 * Soft delete a vendor (set is_active = false)
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
        { error: "Vendor ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Check for active vendor links
    const { data: activeLinks } = await supabase
      .from("add_on_vendor_links")
      .select("id")
      .eq("vendor_id", id)
      .eq("is_active", true)
      .limit(1);

    if (activeLinks && activeLinks.length > 0) {
      return NextResponse.json(
        { error: "Cannot deactivate vendor with active add-on links. Remove links first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("vendors")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deleting vendor:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
