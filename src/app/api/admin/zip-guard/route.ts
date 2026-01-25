/**
 * Zip Guard API - Manage ZIP code frequency restrictions
 *
 * GET: List all restrictions
 * POST: Create or update restriction
 * DELETE: Remove restriction
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER"];

/**
 * GET /api/admin/zip-guard
 * List all ZIP code restrictions
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const { data: restrictions, error } = await supabase
      .from("zip_frequency_restrictions")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .order("zip", { ascending: true });

    if (error) {
      console.error("Error fetching restrictions:", error);
      return NextResponse.json({ error: "Failed to fetch restrictions" }, { status: 500 });
    }

    // Get list of all service zips from pricing rules
    const { data: pricingRules } = await supabase
      .from("pricing_rules")
      .select("zip")
      .eq("org_id", auth.user.orgId)
      .not("zip", "is", null);

    const serviceZips = [...new Set((pricingRules || []).map((r) => r.zip))].sort();

    return NextResponse.json({
      restrictions: restrictions || [],
      serviceZips,
    });
  } catch (error) {
    console.error("Error in zip-guard GET:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

/**
 * POST /api/admin/zip-guard
 * Create or update a ZIP restriction
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { zip, blockedFrequencies, blockedPlanIds } = body;

    if (!zip || typeof zip !== "string" || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: "Valid 5-digit ZIP code required" }, { status: 400 });
    }

    // Check if restriction exists
    const { data: existing } = await supabase
      .from("zip_frequency_restrictions")
      .select("id")
      .eq("org_id", auth.user.orgId)
      .eq("zip", zip)
      .single();

    const restrictionData = {
      org_id: auth.user.orgId,
      zip,
      blocked_frequencies: blockedFrequencies || [],
      blocked_plan_ids: blockedPlanIds || [],
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("zip_frequency_restrictions")
        .update(restrictionData)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("zip_frequency_restrictions")
        .insert({
          ...restrictionData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: existing ? "ZIP_RESTRICTION_UPDATED" : "ZIP_RESTRICTION_CREATED",
      entity_type: "ZIP_RESTRICTION",
      entity_id: result.id,
      details: { zip, blockedFrequencies },
    });

    return NextResponse.json({ restriction: result });
  } catch (error) {
    console.error("Error in zip-guard POST:", error);
    return NextResponse.json({ error: "Failed to save restriction" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/zip-guard
 * Remove a ZIP restriction
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, zip } = body;

    if (!id && !zip) {
      return NextResponse.json({ error: "ID or ZIP required" }, { status: 400 });
    }

    let query = supabase
      .from("zip_frequency_restrictions")
      .delete()
      .eq("org_id", auth.user.orgId);

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("zip", zip);
    }

    const { error } = await query;

    if (error) {
      console.error("Error deleting restriction:", error);
      return NextResponse.json({ error: "Failed to delete restriction" }, { status: 500 });
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "ZIP_RESTRICTION_DELETED",
      entity_type: "ZIP_RESTRICTION",
      entity_id: id || zip,
      details: { zip },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in zip-guard DELETE:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
