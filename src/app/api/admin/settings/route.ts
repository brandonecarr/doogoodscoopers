/**
 * Admin Settings API
 *
 * Get and update organization settings.
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
 * GET /api/admin/settings
 * Get organization settings
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
    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, settings")
      .eq("id", auth.user.orgId)
      .single();

    if (error || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: org.settings || {},
      orgName: org.name,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * Update organization settings
 */
export async function PUT(request: NextRequest) {
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
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Settings object required" }, { status: 400 });
    }

    // Get current settings to merge
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", auth.user.orgId)
      .single();

    const currentSettings = org?.settings || {};
    const mergedSettings = { ...currentSettings, ...settings };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.user.orgId);

    if (updateError) {
      console.error("Error updating settings:", updateError);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "SETTINGS_UPDATED",
      entity_type: "ORGANIZATION",
      entity_id: auth.user.orgId,
      details: { updatedKeys: Object.keys(settings) },
    });

    return NextResponse.json({
      success: true,
      settings: mergedSettings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
