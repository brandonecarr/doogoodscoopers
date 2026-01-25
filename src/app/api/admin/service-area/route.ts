/**
 * Service Area API
 *
 * Manages service area zip codes for the organization.
 * Zip codes are stored in pricing_rules table with zone (REGULAR/PREMIUM).
 *
 * GET - Returns all zip codes grouped by zone
 * POST - Add or delete zip codes for a zone
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
 * GET /api/admin/service-area
 * Get zip codes from the Service Area rules only (REGULAR/PREMIUM)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "settings:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  // Get only the Service Area pricing rules (not all pricing rules)
  const { data: regularRule } = await supabase
    .from("pricing_rules")
    .select("zip_codes")
    .eq("org_id", auth.user.orgId)
    .eq("name", "Service Area - REGULAR")
    .eq("is_active", true)
    .single();

  const { data: premiumRule } = await supabase
    .from("pricing_rules")
    .select("zip_codes")
    .eq("org_id", auth.user.orgId)
    .eq("name", "Service Area - PREMIUM")
    .eq("is_active", true)
    .single();

  const regularZips = (regularRule?.zip_codes as string[]) || [];
  const premiumZips = (premiumRule?.zip_codes as string[]) || [];

  return NextResponse.json({
    zipCodes: {
      regular: regularZips,
      premium: premiumZips,
    },
  });
}

/**
 * POST /api/admin/service-area
 * Add or delete zip codes for a zone
 *
 * Body: { action: "add" | "delete", zone: "REGULAR" | "PREMIUM", zipCodes: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "settings:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const { action, zone, zipCodes } = body;

    // Validate input
    if (!action || !["add", "delete"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'add' or 'delete'" },
        { status: 400 }
      );
    }

    if (!zone || !["REGULAR", "PREMIUM"].includes(zone)) {
      return NextResponse.json(
        { error: "Invalid zone. Use 'REGULAR' or 'PREMIUM'" },
        { status: 400 }
      );
    }

    if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
      return NextResponse.json(
        { error: "zipCodes must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate zip codes format
    const invalidZips = zipCodes.filter((z) => !/^\d{5}$/.test(z));
    if (invalidZips.length > 0) {
      return NextResponse.json(
        { error: `Invalid zip codes: ${invalidZips.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Find or create the service area pricing rule for this zone
    // We use a convention: one rule per zone named "Service Area - {zone}"
    const ruleName = `Service Area - ${zone}`;

    const { data: existingRule, error: fetchError } = await supabase
      .from("pricing_rules")
      .select("id, zip_codes")
      .eq("org_id", auth.user.orgId)
      .eq("name", ruleName)
      .eq("zone", zone)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching rule:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch service area" },
        { status: 500 }
      );
    }

    const currentZips = new Set<string>((existingRule?.zip_codes as string[]) || []);

    // Track results for detailed feedback
    const added: string[] = [];
    const alreadyExisted: string[] = [];
    const deleted: string[] = [];
    const notFound: string[] = [];
    const inOtherZone: string[] = [];

    if (action === "add") {
      // Get the OTHER zone's zip codes to check for conflicts
      const otherZone = zone === "REGULAR" ? "PREMIUM" : "REGULAR";
      const otherRuleName = `Service Area - ${otherZone}`;

      const { data: otherRule } = await supabase
        .from("pricing_rules")
        .select("zip_codes")
        .eq("org_id", auth.user.orgId)
        .eq("name", otherRuleName)
        .single();

      const otherZoneZips = new Set<string>((otherRule?.zip_codes as string[]) || []);

      // Add new zip codes, track which ones already exist or are in the other zone
      for (const zip of zipCodes) {
        if (otherZoneZips.has(zip)) {
          inOtherZone.push(zip);
        } else if (currentZips.has(zip)) {
          alreadyExisted.push(zip);
        } else {
          currentZips.add(zip);
          added.push(zip);
        }
      }
    } else {
      // Delete zip codes, track which ones weren't found
      for (const zip of zipCodes) {
        if (currentZips.has(zip)) {
          currentZips.delete(zip);
          deleted.push(zip);
        } else {
          notFound.push(zip);
        }
      }
    }

    const updatedZips = Array.from(currentZips);

    if (existingRule) {
      // Update existing rule
      const { error: updateError } = await supabase
        .from("pricing_rules")
        .update({ zip_codes: updatedZips })
        .eq("id", existingRule.id);

      if (updateError) {
        console.error("Error updating rule:", updateError);
        return NextResponse.json(
          { error: "Failed to update service area" },
          { status: 500 }
        );
      }
    } else {
      // Create new rule for this zone
      const { error: insertError } = await supabase
        .from("pricing_rules")
        .insert({
          org_id: auth.user.orgId,
          name: ruleName,
          description: `Service area zip codes for ${zone.toLowerCase()} pricing`,
          zone,
          zip_codes: updatedZips,
          base_price_cents: 0, // Base price - actual pricing handled by other rules
          is_active: true,
          priority: zone === "PREMIUM" ? 10 : 5, // Premium takes precedence
        });

      if (insertError) {
        console.error("Error creating rule:", insertError);
        return NextResponse.json(
          { error: "Failed to create service area" },
          { status: 500 }
        );
      }
    }

    // Build response with detailed results
    const response: {
      success: boolean;
      action: string;
      zone: string;
      zipCodes: string[];
      added?: string[];
      alreadyExisted?: string[];
      inOtherZone?: string[];
      deleted?: string[];
      notFound?: string[];
      message: string;
    } = {
      success: true,
      action,
      zone,
      zipCodes: updatedZips,
      message: "",
    };

    if (action === "add") {
      response.added = added;
      response.alreadyExisted = alreadyExisted;
      response.inOtherZone = inOtherZone;

      const otherZoneName = zone === "REGULAR" ? "Premium" : "Regular";
      const parts: string[] = [];

      if (added.length > 0) {
        parts.push(`Added ${added.length} zip code(s)`);
      }
      if (alreadyExisted.length > 0) {
        parts.push(`${alreadyExisted.length} already existed`);
      }
      if (inOtherZone.length > 0) {
        parts.push(`${inOtherZone.length} already in ${otherZoneName} zone`);
      }

      if (parts.length === 0) {
        response.message = "No zip codes to add";
        response.success = false;
      } else {
        response.message = parts.join(". ");
        // Only full success if all were added
        if (added.length === 0 || alreadyExisted.length > 0 || inOtherZone.length > 0) {
          response.success = added.length > 0; // Partial success if at least some were added
        }
      }
    } else {
      response.deleted = deleted;
      response.notFound = notFound;

      if (deleted.length > 0 && notFound.length === 0) {
        response.message = `Successfully deleted ${deleted.length} zip code(s)`;
      } else if (deleted.length === 0 && notFound.length > 0) {
        response.message = `None of the ${notFound.length} zip code(s) were found in the list`;
        response.success = false;
      } else if (deleted.length > 0 && notFound.length > 0) {
        response.message = `Deleted ${deleted.length} zip code(s). ${notFound.length} not found`;
      } else {
        response.message = "No zip codes to delete";
        response.success = false;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing service area update:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
