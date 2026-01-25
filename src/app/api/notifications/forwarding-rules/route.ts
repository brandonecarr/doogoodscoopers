/**
 * Reply Forwarding Rules API
 *
 * Manage rules for forwarding inbound messages to staff.
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
    const { data: rules, error } = await supabase
      .from("reply_forwarding_rules")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching forwarding rules:", error);
      return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }

    return NextResponse.json({
      rules: (rules || []).map((r) => ({
        id: r.id,
        name: r.name,
        forwardToType: r.forward_to_type,
        forwardToValue: r.forward_to_value,
        conditions: r.conditions,
        isEnabled: r.is_enabled,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching forwarding rules:", error);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
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
    const { name, forwardToType, forwardToValue, conditions } = body;

    if (!name || !forwardToType || !forwardToValue) {
      return NextResponse.json(
        { error: "Name, forward type, and forward value are required" },
        { status: 400 }
      );
    }

    if (!["EMAIL", "SMS", "WEBHOOK"].includes(forwardToType)) {
      return NextResponse.json({ error: "Invalid forward type" }, { status: 400 });
    }

    const { data: rule, error: insertError } = await supabase
      .from("reply_forwarding_rules")
      .insert({
        org_id: auth.user.orgId,
        name,
        forward_to_type: forwardToType,
        forward_to_value: forwardToValue,
        conditions: conditions || null,
        is_enabled: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating forwarding rule:", insertError);
      return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }

    return NextResponse.json(
      {
        rule: {
          id: rule.id,
          name: rule.name,
          forwardToType: rule.forward_to_type,
          forwardToValue: rule.forward_to_value,
          conditions: rule.conditions,
          isEnabled: rule.is_enabled,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating forwarding rule:", error);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
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
    const { ruleId, name, forwardToType, forwardToValue, conditions, isEnabled } = body;

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    // Verify rule belongs to org
    const { data: existing } = await supabase
      .from("reply_forwarding_rules")
      .select("id")
      .eq("id", ruleId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (forwardToType !== undefined) updates.forward_to_type = forwardToType;
    if (forwardToValue !== undefined) updates.forward_to_value = forwardToValue;
    if (conditions !== undefined) updates.conditions = conditions;
    if (isEnabled !== undefined) updates.is_enabled = isEnabled;

    const { data: rule, error: updateError } = await supabase
      .from("reply_forwarding_rules")
      .update(updates)
      .eq("id", ruleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating forwarding rule:", updateError);
      return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }

    return NextResponse.json({
      rule: {
        id: rule.id,
        name: rule.name,
        forwardToType: rule.forward_to_type,
        forwardToValue: rule.forward_to_value,
        conditions: rule.conditions,
        isEnabled: rule.is_enabled,
      },
    });
  } catch (error) {
    console.error("Error updating forwarding rule:", error);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

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
  const ruleId = searchParams.get("id");

  if (!ruleId) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("reply_forwarding_rules")
      .delete()
      .eq("id", ruleId)
      .eq("org_id", auth.user.orgId);

    if (error) {
      console.error("Error deleting forwarding rule:", error);
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting forwarding rule:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
