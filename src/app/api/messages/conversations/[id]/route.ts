/**
 * Conversation Detail API
 *
 * Get conversation details, messages, and send replies.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";
import { sendSms, isTwilioConfigured, normalizePhoneNumber } from "@/lib/twilio";
import { sendEmail, isResendConfigured, wrapEmailHtml } from "@/lib/resend";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id: conversationId } = await params;
  const supabase = getSupabase();

  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("message_conversations")
      .select(`
        id,
        channel,
        status,
        unread_count,
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
          scheduled_date,
          status
        ),
        location:location_id (
          id,
          address_line1,
          city
        )
      `)
      .eq("id", conversationId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get messages
    const { data: messages } = await supabase
      .from("messages")
      .select(`
        id,
        direction,
        body,
        status,
        provider,
        provider_message_id,
        sent_by,
        created_at
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    // Mark as read
    await supabase
      .from("message_conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId);

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        channel: conversation.channel,
        status: conversation.status,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: conversation.client as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (conversation.client as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: `${(conversation.client as any).first_name} ${(conversation.client as any).last_name}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (conversation.client as any).email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              phone: (conversation.client as any).phone,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedTo: conversation.staff as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (conversation.staff as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: `${(conversation.staff as any).first_name} ${(conversation.staff as any).last_name}`,
            }
          : null,
      },
      messages: (messages || []).map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        status: m.status,
        provider: m.provider,
        sentBy: m.sent_by,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id: conversationId } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get conversation with client
    const { data: conversation } = await supabase
      .from("message_conversations")
      .select(`
        id,
        channel,
        org_id,
        client:client_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq("id", conversationId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = conversation.client as any;
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Determine recipient
    const recipient = conversation.channel === "SMS" ? client.phone : client.email;
    if (!recipient) {
      return NextResponse.json(
        { error: `Client has no ${conversation.channel === "SMS" ? "phone" : "email"} on file` },
        { status: 400 }
      );
    }

    // Create message record
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        org_id: auth.user.orgId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        body: message,
        status: "PENDING",
        sent_by: auth.user.id,
      })
      .select()
      .single();

    if (msgError || !newMessage) {
      console.error("Error creating message:", msgError);
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
    }

    // Send the message
    let sendResult;
    if (conversation.channel === "SMS") {
      if (!isTwilioConfigured()) {
        await supabase
          .from("messages")
          .update({ status: "FAILED" })
          .eq("id", newMessage.id);
        return NextResponse.json({ error: "SMS not configured" }, { status: 500 });
      }

      const normalizedPhone = normalizePhoneNumber(recipient);
      if (!normalizedPhone) {
        await supabase
          .from("messages")
          .update({ status: "FAILED" })
          .eq("id", newMessage.id);
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }

      const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/twilio/status`
        : undefined;

      sendResult = await sendSms({
        to: normalizedPhone,
        body: message,
        statusCallback: webhookUrl,
      });
    } else {
      if (!isResendConfigured()) {
        await supabase
          .from("messages")
          .update({ status: "FAILED" })
          .eq("id", newMessage.id);
        return NextResponse.json({ error: "Email not configured" }, { status: 500 });
      }

      sendResult = await sendEmail({
        to: recipient,
        subject: "Message from DooGoodScoopers",
        html: wrapEmailHtml(`<p>${message}</p>`),
      });
    }

    // Update message with result
    if (sendResult.success) {
      await supabase
        .from("messages")
        .update({
          status: "SENT",
          provider: conversation.channel === "SMS" ? "twilio" : "resend",
          provider_message_id: sendResult.messageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newMessage.id);

      // Update conversation
      await supabase
        .from("message_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return NextResponse.json({
        success: true,
        message: {
          id: newMessage.id,
          direction: "OUTBOUND",
          body: message,
          status: "SENT",
          createdAt: newMessage.created_at,
        },
      });
    } else {
      await supabase
        .from("messages")
        .update({ status: "FAILED" })
        .eq("id", newMessage.id);

      return NextResponse.json({ error: sendResult.error || "Failed to send" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { id: conversationId } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { status, assignToStaffId } = body;

    // Verify conversation belongs to org
    const { data: existing } = await supabase
      .from("message_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
    }
    if (assignToStaffId !== undefined) {
      updates.staff_id = assignToStaffId;
    }

    const { error: updateError } = await supabase
      .from("message_conversations")
      .update(updates)
      .eq("id", conversationId);

    if (updateError) {
      console.error("Error updating conversation:", updateError);
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Conversation updated" });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
