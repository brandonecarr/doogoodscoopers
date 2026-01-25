/**
 * Admin Add-ons API
 *
 * CRUD operations for service add-ons.
 * Requires pricing:read for GET, pricing:write for POST/PUT/DELETE.
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
 * GET /api/admin/add-ons
 * List all add-ons for the organization
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
  const recurringOnly = searchParams.get("recurring") === "true";

  let query = supabase
    .from("add_ons")
    .select("*")
    .eq("org_id", auth.user.orgId)
    .order("sort_order", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }
  if (recurringOnly) {
    query = query.eq("is_recurring", true);
  }

  const { data: addOns, error } = await query;

  if (error) {
    console.error("Error fetching add-ons:", error);
    return NextResponse.json(
      { error: "Failed to fetch add-ons" },
      { status: 500 }
    );
  }

  // Transform to camelCase for frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedAddOns = (addOns || []).map((addOn: any) => ({
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    priceCents: addOn.price_cents,
    priceType: addOn.price_type,
    isRecurring: addOn.is_recurring,
    isActive: addOn.is_active,
    sortOrder: addOn.sort_order,
    createdAt: addOn.created_at,
    updatedAt: addOn.updated_at,
  }));

  return NextResponse.json({ addOns: formattedAddOns });
}

/**
 * POST /api/admin/add-ons
 * Create a new add-on
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Accept both camelCase and snake_case
    const priceCents = body.priceCents ?? body.price_cents;
    const priceType = body.priceType ?? body.price_type;
    const isRecurring = body.isRecurring ?? body.is_recurring;
    const isActive = body.isActive ?? body.is_active;
    const sortOrderInput = body.sortOrder ?? body.sort_order;

    // Validate required fields
    if (!body.name || priceCents === undefined) {
      return NextResponse.json(
        { error: "Name and priceCents are required" },
        { status: 400 }
      );
    }

    // Validate priceType if provided
    if (priceType) {
      const validPriceTypes = ["FIXED", "PER_DOG", "PER_VISIT"];
      if (!validPriceTypes.includes(priceType)) {
        return NextResponse.json(
          { error: "Invalid priceType. Must be FIXED, PER_DOG, or PER_VISIT" },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabase();

    // Get max sort order
    const { data: maxSort } = await supabase
      .from("add_ons")
      .select("sort_order")
      .eq("org_id", auth.user.orgId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxSort?.sort_order ?? 0) + 1;

    // Create the add-on
    const { data: addOn, error } = await supabase
      .from("add_ons")
      .insert({
        org_id: auth.user.orgId,
        name: body.name,
        description: body.description || null,
        price_cents: priceCents,
        price_type: priceType || "FIXED",
        is_recurring: isRecurring ?? false,
        is_active: isActive ?? true,
        sort_order: sortOrderInput ?? sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating add-on:", error);
      return NextResponse.json(
        { error: "Failed to create add-on" },
        { status: 500 }
      );
    }

    // Return formatted response
    const formattedAddOn = {
      id: addOn.id,
      name: addOn.name,
      description: addOn.description,
      priceCents: addOn.price_cents,
      priceType: addOn.price_type,
      isRecurring: addOn.is_recurring,
      isActive: addOn.is_active,
      sortOrder: addOn.sort_order,
      createdAt: addOn.created_at,
      updatedAt: addOn.updated_at,
    };

    return NextResponse.json({ addOn: formattedAddOn }, { status: 201 });
  } catch (error) {
    console.error("Error creating add-on:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/add-ons
 * Update an existing add-on
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
        { error: "Add-on ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify add-on belongs to org
    const { data: existing } = await supabase
      .from("add_ons")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Add-on not found" },
        { status: 404 }
      );
    }

    // Accept both camelCase and snake_case
    const priceCents = body.priceCents ?? body.price_cents;
    const priceType = body.priceType ?? body.price_type;
    const isRecurring = body.isRecurring ?? body.is_recurring;
    const isActive = body.isActive ?? body.is_active;
    const sortOrderInput = body.sortOrder ?? body.sort_order;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (priceCents !== undefined) updates.price_cents = priceCents;
    if (priceType !== undefined) {
      const validPriceTypes = ["FIXED", "PER_DOG", "PER_VISIT"];
      if (!validPriceTypes.includes(priceType)) {
        return NextResponse.json(
          { error: "Invalid priceType" },
          { status: 400 }
        );
      }
      updates.price_type = priceType;
    }
    if (isRecurring !== undefined) updates.is_recurring = isRecurring;
    if (isActive !== undefined) updates.is_active = isActive;
    if (sortOrderInput !== undefined) updates.sort_order = sortOrderInput;

    // Update the add-on
    const { data: addOn, error } = await supabase
      .from("add_ons")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating add-on:", error);
      return NextResponse.json(
        { error: "Failed to update add-on" },
        { status: 500 }
      );
    }

    // Return formatted response
    const formattedAddOn = {
      id: addOn.id,
      name: addOn.name,
      description: addOn.description,
      priceCents: addOn.price_cents,
      priceType: addOn.price_type,
      isRecurring: addOn.is_recurring,
      isActive: addOn.is_active,
      sortOrder: addOn.sort_order,
      createdAt: addOn.created_at,
      updatedAt: addOn.updated_at,
    };

    return NextResponse.json({ addOn: formattedAddOn });
  } catch (error) {
    console.error("Error updating add-on:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/add-ons
 * Delete an add-on (soft delete by setting is_active = false)
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
        { error: "Add-on ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify add-on belongs to org
    const { data: existing } = await supabase
      .from("add_ons")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Add-on not found" },
        { status: 404 }
      );
    }

    // Check for active subscription add-ons using this add-on
    const { data: subscriptionAddOns } = await supabase
      .from("subscription_add_ons")
      .select("id, subscription:subscription_id(status)")
      .eq("add_on_id", id)
      .limit(10);

    const hasActiveUsage = subscriptionAddOns?.some(
      (sa) => (sa.subscription as unknown as { status: string })?.status === "ACTIVE"
    );

    if (hasActiveUsage) {
      return NextResponse.json(
        { error: "Cannot delete add-on with active subscriptions" },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from("add_ons")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deleting add-on:", error);
      return NextResponse.json(
        { error: "Failed to delete add-on" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting add-on:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
