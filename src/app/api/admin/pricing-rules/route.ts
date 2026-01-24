/**
 * Admin Pricing Rules API
 *
 * CRUD operations for pricing rules.
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
 * GET /api/admin/pricing-rules
 * List all pricing rules for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Optional filters
  const frequency = searchParams.get("frequency");
  const zone = searchParams.get("zone");
  const planId = searchParams.get("plan_id");

  let query = supabase
    .from("pricing_rules")
    .select(`
      *,
      service_plan:plan_id (
        id,
        name,
        frequency
      )
    `)
    .eq("org_id", auth.user.orgId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (frequency) {
    query = query.eq("frequency", frequency);
  }
  if (zone) {
    query = query.eq("zone", zone);
  }
  if (planId) {
    query = query.eq("plan_id", planId);
  }

  const { data: rules, error } = await query;

  if (error) {
    console.error("Error fetching pricing rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing rules" },
      { status: 500 }
    );
  }

  return NextResponse.json({ rules });
}

/**
 * POST /api/admin/pricing-rules
 * Create a new pricing rule
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || body.base_price_cents === undefined) {
      return NextResponse.json(
        { error: "Name and base_price_cents are required" },
        { status: 400 }
      );
    }

    // Validate frequency if provided
    if (body.frequency) {
      const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          { error: "Invalid frequency" },
          { status: 400 }
        );
      }
    }

    // Validate zone if provided
    if (body.zone) {
      const validZones = ["REGULAR", "PREMIUM"];
      if (!validZones.includes(body.zone)) {
        return NextResponse.json(
          { error: "Invalid zone" },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabase();

    // Create the rule
    const { data: rule, error } = await supabase
      .from("pricing_rules")
      .insert({
        org_id: auth.user.orgId,
        plan_id: body.plan_id || null,
        name: body.name,
        description: body.description || null,
        zip_codes: body.zip_codes || [],
        zone: body.zone || null,
        frequency: body.frequency || null,
        min_dogs: body.min_dogs ?? null,
        max_dogs: body.max_dogs ?? null,
        last_cleaned_bracket: body.last_cleaned_bracket || null,
        base_price_cents: body.base_price_cents,
        per_dog_price_cents: body.per_dog_price_cents ?? 0,
        initial_cleanup_cents: body.initial_cleanup_cents ?? 0,
        priority: body.priority ?? 0,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to create pricing rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating pricing rule:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/pricing-rules
 * Update an existing pricing rule
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
        { error: "Rule ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify rule belongs to org
    const { data: existing } = await supabase
      .from("pricing_rules")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Pricing rule not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.plan_id !== undefined) updates.plan_id = body.plan_id;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.zip_codes !== undefined) updates.zip_codes = body.zip_codes;
    if (body.zone !== undefined) {
      if (body.zone && !["REGULAR", "PREMIUM"].includes(body.zone)) {
        return NextResponse.json(
          { error: "Invalid zone" },
          { status: 400 }
        );
      }
      updates.zone = body.zone;
    }
    if (body.frequency !== undefined) {
      if (body.frequency && !["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"].includes(body.frequency)) {
        return NextResponse.json(
          { error: "Invalid frequency" },
          { status: 400 }
        );
      }
      updates.frequency = body.frequency;
    }
    if (body.min_dogs !== undefined) updates.min_dogs = body.min_dogs;
    if (body.max_dogs !== undefined) updates.max_dogs = body.max_dogs;
    if (body.last_cleaned_bracket !== undefined)
      updates.last_cleaned_bracket = body.last_cleaned_bracket;
    if (body.base_price_cents !== undefined)
      updates.base_price_cents = body.base_price_cents;
    if (body.per_dog_price_cents !== undefined)
      updates.per_dog_price_cents = body.per_dog_price_cents;
    if (body.initial_cleanup_cents !== undefined)
      updates.initial_cleanup_cents = body.initial_cleanup_cents;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    // Update the rule
    const { data: rule, error } = await supabase
      .from("pricing_rules")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to update pricing rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating pricing rule:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/pricing-rules
 * Delete a pricing rule
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
        { error: "Rule ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify rule belongs to org
    const { data: existing } = await supabase
      .from("pricing_rules")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Pricing rule not found" },
        { status: 404 }
      );
    }

    // Delete the rule (hard delete since rules can be recreated)
    const { error } = await supabase
      .from("pricing_rules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to delete pricing rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing rule:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
