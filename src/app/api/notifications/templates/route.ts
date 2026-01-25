/**
 * Notification Templates API
 *
 * Manage notification templates for SMS and Email.
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

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE"];

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const channel = searchParams.get("channel");

  try {
    let query = supabase
      .from("notification_templates")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .order("type", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }
    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    return NextResponse.json({
      templates: (templates || []).map((t) => ({
        id: t.id,
        type: t.type,
        channel: t.channel,
        name: t.name,
        subject: t.subject,
        body: t.body,
        isEnabled: t.is_enabled,
        variables: t.variables || [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

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
    const { type, channel, name, subject, templateBody, variables } = body;

    if (!type || !channel || !name || !templateBody) {
      return NextResponse.json(
        { error: "Type, channel, name, and body are required" },
        { status: 400 }
      );
    }

    // Check if template already exists for this type/channel
    const { data: existing } = await supabase
      .from("notification_templates")
      .select("id")
      .eq("org_id", auth.user.orgId)
      .eq("type", type)
      .eq("channel", channel)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Template already exists for this type and channel" },
        { status: 400 }
      );
    }

    const { data: template, error: insertError } = await supabase
      .from("notification_templates")
      .insert({
        org_id: auth.user.orgId,
        type,
        channel,
        name,
        subject: subject || null,
        body: templateBody,
        is_enabled: true,
        variables: variables || extractVariables(templateBody),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating template:", insertError);
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }

    return NextResponse.json(
      {
        template: {
          id: template.id,
          type: template.type,
          channel: template.channel,
          name: template.name,
          subject: template.subject,
          body: template.body,
          isEnabled: template.is_enabled,
          variables: template.variables,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

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
    const { templateId, name, subject, templateBody, isEnabled, variables } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to org
    const { data: existing } = await supabase
      .from("notification_templates")
      .select("id")
      .eq("id", templateId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (templateBody !== undefined) {
      updates.body = templateBody;
      updates.variables = variables || extractVariables(templateBody);
    }
    if (isEnabled !== undefined) updates.is_enabled = isEnabled;

    const { data: template, error: updateError } = await supabase
      .from("notification_templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating template:", updateError);
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        type: template.type,
        channel: template.channel,
        name: template.name,
        subject: template.subject,
        body: template.body,
        isEnabled: template.is_enabled,
        variables: template.variables,
      },
    });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

/**
 * Extract variable names from a template body
 */
function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{[\s]*([a-zA-Z_]+)[\s]*\}\}/g);
  if (!matches) return [];

  const variables = new Set<string>();
  for (const match of matches) {
    const varName = match.replace(/\{\{[\s]*|[\s]*\}\}/g, "");
    variables.add(varName);
  }

  return Array.from(variables);
}
