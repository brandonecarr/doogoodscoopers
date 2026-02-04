/**
 * Credit Card Link API (Admin)
 *
 * POST /api/admin/clients/[id]/cards/link - Generate a temporary card-add link
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import crypto from "crypto";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/clients/[id]/cards/link
 * Generate a temporary card-add link for the client
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("credit_card_links")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        token,
        expires_at: expiresAt,
        created_by: auth.user.id,
      });

    if (insertError) {
      console.error("Error creating card link:", insertError);
      return NextResponse.json(
        { error: "Failed to create card link" },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.com";
    const link = `${baseUrl}/add-card/${token}`;

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CARD_LINK_CREATED",
      entity_type: "CLIENT",
      entity_id: clientId,
      details: { token, expiresAt },
    });

    return NextResponse.json({ link, token, expiresAt });
  } catch (error) {
    console.error("Error generating card link:", error);
    return NextResponse.json(
      { error: "Failed to generate card link" },
      { status: 500 }
    );
  }
}
