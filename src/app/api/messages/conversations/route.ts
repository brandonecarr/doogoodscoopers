/**
 * Conversations API
 *
 * List and manage message conversations.
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

  const status = searchParams.get("status") || "OPEN";
  const channel = searchParams.get("channel");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("message_conversations")
      .select(
        `
        id,
        channel,
        status,
        unread_count,
        last_message_at,
        created_at,
        updated_at,
        client:client_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        staff:staff_id (
          id,
          first_name,
          last_name
        ),
        job:job_id (
          id,
          scheduled_date
        ),
        location:location_id (
          id,
          address_line1,
          city
        )
      `,
        { count: "exact" }
      )
      .eq("org_id", auth.user.orgId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "ALL") {
      query = query.eq("status", status);
    }
    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data: conversations, count, error } = await query;

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Get last message for each conversation
    const conversationIds = (conversations || []).map((c) => c.id);
    let lastMessages: Record<string, { body: string; direction: string; created_at: string }> = {};

    if (conversationIds.length > 0) {
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, body, direction, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      // Group by conversation and take first (most recent)
      for (const msg of messages || []) {
        if (!lastMessages[msg.conversation_id]) {
          lastMessages[msg.conversation_id] = {
            body: msg.body,
            direction: msg.direction,
            created_at: msg.created_at,
          };
        }
      }
    }

    // Get unread counts
    const { data: unreadData } = await supabase
      .from("message_conversations")
      .select("status")
      .eq("org_id", auth.user.orgId);

    const statusCounts = {
      open: unreadData?.filter((c) => c.status === "OPEN").length || 0,
      closed: unreadData?.filter((c) => c.status === "CLOSED").length || 0,
    };

    return NextResponse.json({
      conversations: (conversations || []).map((c) => ({
        id: c.id,
        channel: c.channel,
        status: c.status,
        unreadCount: c.unread_count || 0,
        lastMessageAt: c.last_message_at,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: c.client as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (c.client as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: `${(c.client as any).first_name} ${(c.client as any).last_name}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (c.client as any).email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              phone: (c.client as any).phone,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedTo: c.staff as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (c.staff as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: `${(c.staff as any).first_name} ${(c.staff as any).last_name}`,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        job: c.job as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (c.job as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              date: (c.job as any).scheduled_date,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: c.location as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (c.location as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              address: (c.location as any).address_line1,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              city: (c.location as any).city,
            }
          : null,
        lastMessage: lastMessages[c.id] || null,
      })),
      stats: statusCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
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
    const { clientId, channel, jobId, locationId } = body;

    if (!clientId || !channel) {
      return NextResponse.json({ error: "Client ID and channel required" }, { status: 400 });
    }

    // Verify client belongs to org
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check for existing open conversation
    const { data: existing } = await supabase
      .from("message_conversations")
      .select("id")
      .eq("client_id", clientId)
      .eq("channel", channel)
      .eq("status", "OPEN")
      .single();

    if (existing) {
      return NextResponse.json({
        conversation: { id: existing.id },
        message: "Existing conversation found",
      });
    }

    // Create new conversation
    const { data: conversation, error: createError } = await supabase
      .from("message_conversations")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        channel,
        job_id: jobId || null,
        location_id: locationId || null,
        status: "OPEN",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating conversation:", createError);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    return NextResponse.json(
      {
        conversation: { id: conversation.id },
        message: "Conversation created",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
