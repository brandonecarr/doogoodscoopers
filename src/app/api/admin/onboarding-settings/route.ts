/**
 * Onboarding Settings API
 *
 * Manages client onboarding form settings for the organization.
 * Settings are stored in the organization's settings JSONB column.
 *
 * GET - Returns current onboarding settings
 * POST - Updates onboarding settings
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

/**
 * GET /api/admin/onboarding-settings
 * Get current onboarding settings for the organization
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

  return NextResponse.json({
    settings: org?.settings || {},
  });
}

/**
 * POST /api/admin/onboarding-settings
 * Update onboarding settings for the organization
 *
 * Body: { onboarding?: OnboardingSettings, calloutDisclaimers?: CalloutDisclaimersSettings, thankYouPages?: ThankYouPageSettings, emailSettings?: EmailSettings }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "settings:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const { onboarding, calloutDisclaimers, thankYouPages, emailSettings } = body;

    // At least one settings type must be provided
    if (!onboarding && !calloutDisclaimers && !thankYouPages && !emailSettings) {
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
    const updatedSettings = { ...currentSettings };

    if (onboarding) {
      updatedSettings.onboarding = onboarding;
    }

    if (calloutDisclaimers) {
      updatedSettings.calloutDisclaimers = calloutDisclaimers;
    }

    if (thankYouPages) {
      updatedSettings.thankYouPages = thankYouPages;
    }

    if (emailSettings) {
      updatedSettings.emailSettings = emailSettings;
    }

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
      message: "Settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error processing settings update:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
