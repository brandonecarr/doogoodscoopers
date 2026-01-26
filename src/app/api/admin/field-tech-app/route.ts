/**
 * Field Tech App Settings API
 *
 * Manages field tech app settings for the organization.
 * Settings are stored in the organization's settings JSONB column.
 *
 * GET - Returns current field tech app settings
 * PUT - Updates field tech app settings
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Default settings
const defaultSettings = {
  directions: {
    useDestinationAddress: false,
  },
  routeReoptimization: {
    allowReoptimize: true,
  },
  skippedCompletedJobs: {
    customNoteToClient: true,
    attachPhotoForClient: true,
  },
  clientInfoVisibility: {
    homePhone: true,
    cellPhone: true,
    email: true,
  },
  spentTime: {
    showSpentVsEstimated: true,
  },
  paySlipsProductivity: {
    showPaySlips: false,
  },
  ratingsComments: {
    showToFieldTech: true,
  },
  commercialWorkAreas: {
    showWorkAreasCards: false,
  },
};

/**
 * GET /api/admin/field-tech-app
 * Get current field tech app settings for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "settings:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", auth.user.orgId)
    .single();

  if (error) {
    console.error("Error fetching organization settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  const settings = (org?.settings as Record<string, unknown>) || {};
  const fieldTechAppSettings = settings.fieldTechApp || defaultSettings;

  return NextResponse.json({
    settings: fieldTechAppSettings,
  });
}

/**
 * PUT /api/admin/field-tech-app
 * Update field tech app settings for the organization
 *
 * Body: { settings: FieldTechAppSettings }
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "settings:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const { settings: newSettings } = body;

    if (!newSettings) {
      return NextResponse.json(
        { error: "Missing settings data" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get current settings
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", auth.user.orgId)
      .single();

    if (fetchError) {
      console.error("Error fetching organization:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch organization" },
        { status: 500 }
      );
    }

    // Merge new settings with existing settings
    const currentSettings = (org?.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      fieldTechApp: newSettings,
    };

    // Update organization settings
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("id", auth.user.orgId);

    if (updateError) {
      console.error("Error updating settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Field tech app settings updated successfully",
      settings: newSettings,
    });
  } catch (error) {
    console.error("Error processing settings update:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
