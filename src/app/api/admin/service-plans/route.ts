/**
 * Admin Service Plans API
 *
 * CRUD operations for service plans.
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
 * GET /api/admin/service-plans
 * List all service plans for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  const { data: plans, error } = await supabase
    .from("service_plans")
    .select("*")
    .eq("org_id", auth.user.orgId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching service plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch service plans" },
      { status: 500 }
    );
  }

  return NextResponse.json({ plans });
}

/**
 * POST /api/admin/service-plans
 * Create a new service plan
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "pricing:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.frequency) {
      return NextResponse.json(
        { error: "Name and frequency are required" },
        { status: 400 }
      );
    }

    // Validate frequency
    const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"];
    if (!validFrequencies.includes(body.frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get max sort order
    const { data: maxSort } = await supabase
      .from("service_plans")
      .select("sort_order")
      .eq("org_id", auth.user.orgId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxSort?.sort_order ?? 0) + 1;

    // Create the plan
    const { data: plan, error } = await supabase
      .from("service_plans")
      .insert({
        org_id: auth.user.orgId,
        name: body.name,
        description: body.description || null,
        frequency: body.frequency,
        is_active: body.is_active ?? true,
        is_default: body.is_default ?? false,
        sort_order: body.sort_order ?? sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating service plan:", error);
      return NextResponse.json(
        { error: "Failed to create service plan" },
        { status: 500 }
      );
    }

    // If this is set as default, unset other defaults
    if (body.is_default) {
      await supabase
        .from("service_plans")
        .update({ is_default: false })
        .eq("org_id", auth.user.orgId)
        .neq("id", plan.id);
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("Error creating service plan:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/service-plans
 * Update an existing service plan
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
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify plan belongs to org
    const { data: existing } = await supabase
      .from("service_plans")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Service plan not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.frequency !== undefined) {
      const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ONETIME"];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          { error: "Invalid frequency" },
          { status: 400 }
        );
      }
      updates.frequency = body.frequency;
    }
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.is_default !== undefined) updates.is_default = body.is_default;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    // Update the plan
    const { data: plan, error } = await supabase
      .from("service_plans")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating service plan:", error);
      return NextResponse.json(
        { error: "Failed to update service plan" },
        { status: 500 }
      );
    }

    // If this is set as default, unset other defaults
    if (body.is_default) {
      await supabase
        .from("service_plans")
        .update({ is_default: false })
        .eq("org_id", auth.user.orgId)
        .neq("id", plan.id);
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error updating service plan:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/service-plans
 * Delete a service plan (soft delete by setting is_active = false)
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
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify plan belongs to org and check for active subscriptions
    const { data: existing } = await supabase
      .from("service_plans")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Service plan not found" },
        { status: 404 }
      );
    }

    // Check for active subscriptions using this plan
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("plan_id", id)
      .eq("status", "ACTIVE")
      .limit(1);

    if (subscriptions && subscriptions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan with active subscriptions" },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from("service_plans")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deleting service plan:", error);
      return NextResponse.json(
        { error: "Failed to delete service plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service plan:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
