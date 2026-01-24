/**
 * Admin Coupons API
 *
 * CRUD operations for coupons.
 * Syncs with Stripe coupons for payment integration.
 * Requires pricing:read for GET, pricing:write for POST/PUT/DELETE.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
  errorResponse,
} from "@/lib/api-auth";
import { createStripeCoupon, deleteStripeCoupon, getStripe } from "@/lib/stripe";

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
 * GET /api/admin/coupons
 * List all coupons for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Optional filters
  const activeOnly = searchParams.get("active") === "true";
  const code = searchParams.get("code");

  let query = supabase
    .from("coupons")
    .select("*")
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }
  if (code) {
    query = query.eq("code", code.toUpperCase());
  }

  const { data: coupons, error } = await query;

  if (error) {
    console.error("Error fetching coupons:", error);
    return NextResponse.json(
      { error: "Failed to fetch coupons" },
      { status: 500 }
    );
  }

  return NextResponse.json({ coupons });
}

/**
 * POST /api/admin/coupons
 * Create a new coupon
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.code || !body.discount_type || body.discount_value === undefined) {
      return NextResponse.json(
        { error: "Code, discount_type, and discount_value are required" },
        { status: 400 }
      );
    }

    // Validate discount_type
    const validDiscountTypes = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_VISITS"];
    if (!validDiscountTypes.includes(body.discount_type)) {
      return NextResponse.json(
        { error: "Invalid discount_type. Must be PERCENTAGE, FIXED_AMOUNT, or FREE_VISITS" },
        { status: 400 }
      );
    }

    // Validate applies_to if provided
    if (body.applies_to) {
      const validAppliesTo = ["ALL", "FIRST_VISIT", "RECURRING"];
      if (!validAppliesTo.includes(body.applies_to)) {
        return NextResponse.json(
          { error: "Invalid applies_to value" },
          { status: 400 }
        );
      }
    }

    // Validate percentage is <= 100
    if (body.discount_type === "PERCENTAGE" && body.discount_value > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const code = body.code.toUpperCase().replace(/\s+/g, "");

    // Check for duplicate code
    const { data: existing } = await supabase
      .from("coupons")
      .select("id")
      .eq("org_id", auth.user.orgId)
      .eq("code", code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Coupon code already exists" },
        { status: 400 }
      );
    }

    // Create the coupon in database
    const { data: coupon, error } = await supabase
      .from("coupons")
      .insert({
        org_id: auth.user.orgId,
        code,
        description: body.description || null,
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        max_uses: body.max_uses ?? null,
        current_uses: 0,
        min_purchase_cents: body.min_purchase_cents ?? null,
        applies_to: body.applies_to || "ALL",
        valid_from: body.valid_from || null,
        valid_until: body.valid_until || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating coupon:", error);
      return NextResponse.json(
        { error: "Failed to create coupon" },
        { status: 500 }
      );
    }

    // Sync to Stripe if discount type is compatible (not FREE_VISITS)
    if (body.sync_to_stripe !== false && body.discount_type !== "FREE_VISITS") {
      try {
        await createStripeCoupon({
          code,
          discountType: body.discount_type as "PERCENTAGE" | "FIXED_AMOUNT",
          discountValue: body.discount_value,
          maxRedemptions: body.max_uses,
          validUntil: body.valid_until ? new Date(body.valid_until) : undefined,
          metadata: {
            coupon_id: coupon.id,
            org_id: auth.user.orgId,
          },
        });
      } catch (stripeError) {
        console.warn("Failed to sync coupon to Stripe:", stripeError);
        // Don't fail the request - coupon is created locally
      }
    }

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/coupons
 * Update an existing coupon
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Coupon ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify coupon belongs to org
    const { data: existing } = await supabase
      .from("coupons")
      .select("id, code, discount_type")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    // Build update object (can't change code or discount_type after creation)
    const updates: Record<string, unknown> = {};
    if (body.description !== undefined) updates.description = body.description;
    if (body.discount_value !== undefined) {
      if (existing.discount_type === "PERCENTAGE" && body.discount_value > 100) {
        return NextResponse.json(
          { error: "Percentage discount cannot exceed 100" },
          { status: 400 }
        );
      }
      updates.discount_value = body.discount_value;
    }
    if (body.max_uses !== undefined) updates.max_uses = body.max_uses;
    if (body.min_purchase_cents !== undefined)
      updates.min_purchase_cents = body.min_purchase_cents;
    if (body.applies_to !== undefined) {
      const validAppliesTo = ["ALL", "FIRST_VISIT", "RECURRING"];
      if (!validAppliesTo.includes(body.applies_to)) {
        return NextResponse.json(
          { error: "Invalid applies_to value" },
          { status: 400 }
        );
      }
      updates.applies_to = body.applies_to;
    }
    if (body.valid_from !== undefined) updates.valid_from = body.valid_from;
    if (body.valid_until !== undefined) updates.valid_until = body.valid_until;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    // Update the coupon
    const { data: coupon, error } = await supabase
      .from("coupons")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating coupon:", error);
      return NextResponse.json(
        { error: "Failed to update coupon" },
        { status: 500 }
      );
    }

    // Note: Stripe coupons are immutable, so we can't update them
    // If critical changes are needed, admin should delete and recreate

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/coupons
 * Delete a coupon (deactivates in both local DB and Stripe)
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Coupon ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get coupon to retrieve code for Stripe
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, code, discount_type")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    // Soft delete locally
    const { error } = await supabase
      .from("coupons")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deleting coupon:", error);
      return NextResponse.json(
        { error: "Failed to delete coupon" },
        { status: 500 }
      );
    }

    // Delete from Stripe if it was synced
    if (coupon.discount_type !== "FREE_VISITS") {
      try {
        await deleteStripeCoupon(coupon.code);
      } catch (stripeError) {
        console.warn("Failed to delete coupon from Stripe:", stripeError);
        // Don't fail - coupon is deactivated locally
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

/**
 * Validate a coupon code for use
 */
export async function validateCoupon(
  orgId: string,
  code: string,
  purchaseAmountCents?: number
): Promise<{
  valid: boolean;
  coupon?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = getSupabase();

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("org_id", orgId)
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!coupon) {
    return { valid: false, error: "Invalid coupon code" };
  }

  // Check max uses
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    return { valid: false, error: "Coupon has reached maximum uses" };
  }

  // Check validity period
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, error: "Coupon is not yet valid" };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, error: "Coupon has expired" };
  }

  // Check minimum purchase
  if (
    coupon.min_purchase_cents !== null &&
    purchaseAmountCents !== undefined &&
    purchaseAmountCents < coupon.min_purchase_cents
  ) {
    return {
      valid: false,
      error: `Minimum purchase of $${(coupon.min_purchase_cents / 100).toFixed(2)} required`,
    };
  }

  return { valid: true, coupon };
}
