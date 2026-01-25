/**
 * Marketing Integrations API
 *
 * Manage marketing connectors (Mailchimp, EZTexting, Direct Mail, Webhooks)
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
const VALID_PROVIDERS = ["MAILCHIMP", "EZTEXTING", "DIRECT_MAIL", "WEBHOOK_GENERIC"];

/**
 * GET /api/marketing/integrations
 * List all marketing integrations
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
    const { data: integrations, error } = await supabase
      .from("marketing_integrations")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching integrations:", error);
      return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
    }

    // Get sync event counts for each integration
    const integrationIds = (integrations || []).map((i) => i.id);
    let syncCounts: Record<string, { success: number; failed: number; pending: number }> = {};

    if (integrationIds.length > 0) {
      const { data: syncStats } = await supabase
        .from("marketing_sync_events")
        .select("integration_id, status")
        .in("integration_id", integrationIds);

      for (const event of syncStats || []) {
        if (!syncCounts[event.integration_id]) {
          syncCounts[event.integration_id] = { success: 0, failed: 0, pending: 0 };
        }
        if (event.status === "SUCCESS") syncCounts[event.integration_id].success++;
        else if (event.status === "FAILED") syncCounts[event.integration_id].failed++;
        else syncCounts[event.integration_id].pending++;
      }
    }

    return NextResponse.json({
      integrations: (integrations || []).map((i) => ({
        id: i.id,
        provider: i.provider,
        name: i.name,
        isEnabled: i.is_enabled,
        config: sanitizeConfig(i.config, i.provider),
        syncStats: syncCounts[i.id] || { success: 0, failed: 0, pending: 0 },
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

/**
 * POST /api/marketing/integrations
 * Create a new marketing integration
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
    const { provider, name, config, isEnabled } = body;

    if (!provider || !name) {
      return NextResponse.json(
        { error: "Provider and name are required" },
        { status: 400 }
      );
    }

    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate config based on provider
    const validationError = validateConfig(provider, config);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: integration, error: insertError } = await supabase
      .from("marketing_integrations")
      .insert({
        org_id: auth.user.orgId,
        provider,
        name,
        config: config || {},
        is_enabled: isEnabled ?? false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating integration:", insertError);
      return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
    }

    return NextResponse.json(
      {
        integration: {
          id: integration.id,
          provider: integration.provider,
          name: integration.name,
          isEnabled: integration.is_enabled,
          config: sanitizeConfig(integration.config, integration.provider),
          createdAt: integration.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}

/**
 * PUT /api/marketing/integrations
 * Update a marketing integration
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
    const { id, name, config, isEnabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Integration ID required" }, { status: 400 });
    }

    // Verify integration belongs to org
    const { data: existing } = await supabase
      .from("marketing_integrations")
      .select("id, provider, config")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    // Validate config if provided
    if (config !== undefined) {
      const validationError = validateConfig(existing.provider, config);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (config !== undefined) updates.config = { ...existing.config, ...config };
    if (isEnabled !== undefined) updates.is_enabled = isEnabled;

    const { data: integration, error: updateError } = await supabase
      .from("marketing_integrations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating integration:", updateError);
      return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
    }

    return NextResponse.json({
      integration: {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        isEnabled: integration.is_enabled,
        config: sanitizeConfig(integration.config, integration.provider),
        updatedAt: integration.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

/**
 * DELETE /api/marketing/integrations?id=xxx
 * Delete a marketing integration
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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Integration ID required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("marketing_integrations")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.user.orgId);

    if (error) {
      console.error("Error deleting integration:", error);
      return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}

// Validate config based on provider requirements
function validateConfig(provider: string, config: Record<string, unknown> | undefined): string | null {
  if (!config) return null;

  switch (provider) {
    case "MAILCHIMP":
      if (config.apiKey && typeof config.apiKey !== "string") {
        return "Mailchimp API key must be a string";
      }
      if (config.listId && typeof config.listId !== "string") {
        return "Mailchimp list ID must be a string";
      }
      break;

    case "EZTEXTING":
      if (config.username && typeof config.username !== "string") {
        return "EZTexting username must be a string";
      }
      if (config.apiKey && typeof config.apiKey !== "string") {
        return "EZTexting API key must be a string";
      }
      break;

    case "WEBHOOK_GENERIC":
      if (config.url && typeof config.url !== "string") {
        return "Webhook URL must be a string";
      }
      if (config.url && !isValidUrl(config.url as string)) {
        return "Webhook URL must be a valid HTTPS URL";
      }
      break;

    case "DIRECT_MAIL":
      if (config.webhookUrl && !isValidUrl(config.webhookUrl as string)) {
        return "Direct mail webhook URL must be a valid HTTPS URL";
      }
      break;
  }

  return null;
}

// Remove sensitive data from config for API responses
function sanitizeConfig(config: Record<string, unknown>, provider: string): Record<string, unknown> {
  const sanitized = { ...config };

  // Mask API keys
  if (sanitized.apiKey && typeof sanitized.apiKey === "string") {
    sanitized.apiKey = maskString(sanitized.apiKey as string);
  }
  if (sanitized.secret && typeof sanitized.secret === "string") {
    sanitized.secret = maskString(sanitized.secret as string);
  }

  return sanitized;
}

function maskString(str: string): string {
  if (str.length <= 8) return "****";
  return str.slice(0, 4) + "****" + str.slice(-4);
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
