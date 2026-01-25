/**
 * Twilio Webhook
 *
 * Handle inbound SMS messages from Twilio.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseInboundSms, twimlResponse, normalizePhoneNumber } from "@/lib/twilio";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const smsData = parseInboundSms(params);

    // Get the default org (single-tenant for now)
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .single();

    if (!org) {
      console.error("No organization found");
      return new NextResponse(twimlResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Normalize the from phone number
    const normalizedFrom = normalizePhoneNumber(smsData.from);

    // Try to match to a client by phone number
    let matchedClientId: string | null = null;
    let matchedConversationId: string | null = null;

    if (normalizedFrom) {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("org_id", org.id)
        .eq("phone", normalizedFrom)
        .single();

      if (client) {
        matchedClientId = client.id;

        // Look for existing conversation
        const { data: conversation } = await supabase
          .from("message_conversations")
          .select("id")
          .eq("client_id", client.id)
          .eq("channel", "SMS")
          .eq("status", "OPEN")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (conversation) {
          matchedConversationId = conversation.id;
        } else {
          // Create new conversation
          const { data: newConversation } = await supabase
            .from("message_conversations")
            .insert({
              org_id: org.id,
              client_id: client.id,
              channel: "SMS",
              status: "OPEN",
            })
            .select()
            .single();

          if (newConversation) {
            matchedConversationId = newConversation.id;
          }
        }
      }
    }

    // Store the inbound message
    const { error: inboundError } = await supabase.from("inbound_messages").insert({
      org_id: org.id,
      from_address: smsData.from,
      to_address: smsData.to,
      body: smsData.body,
      channel: "SMS",
      provider: "twilio",
      provider_message_id: smsData.messageSid,
      matched_client_id: matchedClientId,
      matched_conversation_id: matchedConversationId,
      processed: !!matchedConversationId,
      media_urls: smsData.mediaUrls.length > 0 ? smsData.mediaUrls : null,
    });

    if (inboundError) {
      console.error("Error storing inbound message:", inboundError);
    }

    // If we have a conversation, add message to it
    if (matchedConversationId) {
      await supabase.from("messages").insert({
        org_id: org.id,
        conversation_id: matchedConversationId,
        direction: "INBOUND",
        body: smsData.body,
        status: "RECEIVED",
        provider: "twilio",
        provider_message_id: smsData.messageSid,
      });

      // Update conversation timestamp and mark as needing attention
      await supabase
        .from("message_conversations")
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          unread_count: supabase.rpc("increment_unread", { conv_id: matchedConversationId }),
        })
        .eq("id", matchedConversationId);
    }

    // Check for auto-reply or forwarding rules
    const { data: forwardRules } = await supabase
      .from("reply_forwarding_rules")
      .select("*")
      .eq("org_id", org.id)
      .eq("is_enabled", true);

    // Process forwarding rules (e.g., forward to staff email)
    if (forwardRules && forwardRules.length > 0) {
      for (const rule of forwardRules) {
        if (rule.forward_to_type === "EMAIL" && rule.forward_to_value) {
          // Queue an email notification about the inbound SMS
          const { sendEmail, wrapEmailHtml } = await import("@/lib/resend");
          await sendEmail({
            to: rule.forward_to_value,
            subject: `New SMS from ${smsData.from}`,
            html: wrapEmailHtml(`
              <p>You received a new SMS message:</p>
              <blockquote style="border-left: 4px solid #14b8a6; padding-left: 16px; margin: 16px 0;">
                ${smsData.body}
              </blockquote>
              <p><strong>From:</strong> ${smsData.from}</p>
              <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/app/office/messages">View in Dashboard</a></p>
            `),
          });
        }
      }
    }

    // Return empty TwiML response (no auto-reply)
    return new NextResponse(twimlResponse(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    return new NextResponse(twimlResponse(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
