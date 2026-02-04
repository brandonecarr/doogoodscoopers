/**
 * Public Add Card API
 *
 * GET  /api/public/add-card/[token] - Validate link and get SetupIntent
 * POST /api/public/add-card/[token] - Mark link as used
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/stripe";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/public/add-card/[token]
 * Validate a card link token and return SetupIntent
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const supabase = getSupabase();

  // Look up the link
  const { data: link, error: linkError } = await supabase
    .from("credit_card_links")
    .select("id, client_id, org_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { valid: false, error: "Link not found" },
      { status: 404 }
    );
  }

  // Check if already used
  if (link.used_at) {
    return NextResponse.json(
      { valid: false, error: "This link has already been used" },
      { status: 410 }
    );
  }

  // Check if expired
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json(
      { valid: false, error: "This link has expired" },
      { status: 410 }
    );
  }

  // Get client info
  const { data: client } = await supabase
    .from("clients")
    .select("first_name, last_name, stripe_customer_id")
    .eq("id", link.client_id)
    .single();

  if (!client) {
    return NextResponse.json(
      { valid: false, error: "Client not found" },
      { status: 404 }
    );
  }

  // Get org info
  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url")
    .eq("id", link.org_id)
    .single();

  try {
    // Ensure Stripe customer exists
    const customer = await getOrCreateStripeCustomer(link.client_id);

    // Create SetupIntent
    const setupIntent = await createSetupIntent(customer.id);

    return NextResponse.json({
      valid: true,
      clientName: [client.first_name, client.last_name]
        .filter(Boolean)
        .join(" "),
      orgName: org?.name || "DooGoodScoopers",
      orgLogo: org?.logo_url || null,
      clientSecret: setupIntent.client_secret,
      linkId: link.id,
    });
  } catch (error) {
    console.error("Error creating SetupIntent:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to initialize card setup" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/public/add-card/[token]
 * Mark a card link as used
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { linkId } = body;

    if (!linkId) {
      return NextResponse.json(
        { error: "linkId is required" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("credit_card_links")
      .update({ used_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("token", token)
      .is("used_at", null);

    if (updateError) {
      console.error("Error marking link as used:", updateError);
      return NextResponse.json(
        { error: "Failed to update link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking link as used:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
