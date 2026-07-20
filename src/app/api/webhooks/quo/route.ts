/**
 * Quo Webhook
 *
 * Receives Quo events (https://api.quo.com/v1 webhooks):
 *   - message.received            → inbound SMS → conversation + messages(INBOUND)
 *   - message.delivered / .failed → delivery status → messages/notifications
 *   - call.*                      → call activity into lead/client timeline (Phase 4)
 *
 * Auth: verified via QUO_WEBHOOK_SECRET (HMAC signature or shared secret); when
 * unset, permissive (matches the app's other webhooks). Returns { success }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { sendAdminPush } from "@/lib/web-push";
import { isOptOutMessage, recordOptOut } from "@/lib/sms-optout";
import {
  verifyQuoWebhook,
  parseInboundMessage,
  quoEventType,
  normalizePhoneNumber,
  getQuoFromNumber,
} from "@/lib/quo";

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Map Quo delivery-status events to the messages.status CHECK values.
const STATUS_MAP: Record<string, string> = {
  "message.delivered": "DELIVERED",
  "message.failed": "FAILED",
  "message.sent": "SENT",
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (
    !verifyQuoWebhook({
      rawBody,
      signatureHeader:
        request.headers.get("quo-signature") ||
        request.headers.get("x-quo-signature") ||
        request.headers.get("openphone-signature"),
      authHeader: request.headers.get("authorization"),
      querySecret: new URL(request.url).searchParams.get("secret"),
    })
  ) {
    console.error("[Quo] Invalid webhook signature");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = quoEventType(payload);
  console.log(`[Quo] Event: ${event}`);

  try {
    const supabase = getSupabase();

    if (event === "message.received") {
      return await handleInbound(supabase, payload);
    }

    if (event in STATUS_MAP) {
      return await handleDeliveryStatus(supabase, payload, STATUS_MAP[event]);
    }

    if (event.startsWith("call.")) {
      return await handleCall(supabase, event, payload);
    }

    return NextResponse.json({ success: true, ignored: true, event });
  } catch (error) {
    console.error("[Quo] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: "Failed to process webhook" }, { status: 500 });
  }
}

async function handleInbound(supabase: SupabaseClient, payload: unknown) {
  const msg = parseInboundMessage(payload);
  const normalizedFrom = normalizePhoneNumber(msg.from);

  // Single-tenant: default org.
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) {
    console.error("[Quo] No organization found");
    return NextResponse.json({ success: true, skipped: true });
  }

  // Match to a client by normalized phone.
  let matchedClientId: string | null = null;
  let matchedConversationId: string | null = null;

  if (normalizedFrom) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, phone")
      .eq("org_id", org.id)
      .eq("phone", normalizedFrom)
      .maybeSingle();

    if (client) {
      matchedClientId = client.id;

      const { data: conversation } = await supabase
        .from("message_conversations")
        .select("id, unread_count")
        .eq("client_id", client.id)
        .eq("channel", "SMS")
        .eq("status", "OPEN")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        matchedConversationId = conversation.id;
      } else {
        const { data: newConversation } = await supabase
          .from("message_conversations")
          .insert({
            org_id: org.id,
            client_id: client.id,
            channel: "SMS",
            status: "OPEN",
            participant_our: getQuoFromNumber() || msg.to,
            participant_their: normalizedFrom,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        matchedConversationId = newConversation?.id ?? null;
      }
    }
  }

  // Raw inbound receipt (media + full payload kept in raw_payload).
  await supabase.from("inbound_messages").insert({
    org_id: org.id,
    from_address: msg.from,
    to_address: msg.to,
    body: msg.body,
    channel: "SMS",
    provider: "quo",
    provider_id: msg.messageId,
    matched_client_id: matchedClientId,
    matched_conversation_id: matchedConversationId,
    processed: !!matchedConversationId,
    raw_payload: (payload as object) ?? {},
  });

  // Thread the message and bump the conversation.
  if (matchedConversationId) {
    await supabase.from("messages").insert({
      org_id: org.id,
      conversation_id: matchedConversationId,
      direction: "INBOUND",
      body: msg.body,
      status: "DELIVERED", // inbound is received; RECEIVED is not a valid status value
      provider: "quo",
      provider_id: msg.messageId,
      metadata: msg.mediaUrls.length ? { mediaUrls: msg.mediaUrls } : {},
    });

    const { data: conv } = await supabase
      .from("message_conversations")
      .select("unread_count")
      .eq("id", matchedConversationId)
      .single();
    await supabase
      .from("message_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: (conv?.unread_count ?? 0) + 1,
      })
      .eq("id", matchedConversationId);
  }

  // No client match → attach the reply to a LEAD (the /admin CRM). Matches
  // QuoteLead first, then AdLead, by phone; logs a LeadMessage + notifies admins.
  if (!matchedClientId && normalizedFrom && msg.messageId) {
    const already = await prisma.leadMessage.findUnique({ where: { quoMessageId: msg.messageId } });
    if (!already) {
      const candidates = phoneCandidates(normalizedFrom);

      // Prefer the lead we're already conversing with on this phone (the most
      // recent existing message thread), so a reply joins the active
      // conversation instead of landing on a stale duplicate lead. Fall back to
      // the most-recently-created lead for the phone.
      let match: { type: LeadSource; id: string; path: string } | null = null;
      const thread = await prisma.leadMessage.findFirst({
        where: { phone: { in: candidates } },
        orderBy: { createdAt: "desc" },
        select: { leadType: true, leadId: true },
      });
      if (thread) {
        match = {
          type: thread.leadType,
          id: thread.leadId,
          path: thread.leadType === "AD_LEAD" ? "ad-leads" : "quote-leads",
        };
      } else {
        const quote = await prisma.quoteLead.findFirst({
          where: { phone: { in: candidates } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (quote) match = { type: "QUOTE_FORM", id: quote.id, path: "quote-leads" };
        else {
          const adl = await prisma.adLead.findFirst({
            where: { phone: { in: candidates } },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          if (adl) match = { type: "AD_LEAD", id: adl.id, path: "ad-leads" };
        }
      }

      if (match) {
        await prisma.leadMessage.create({
          data: {
            leadType: match.type,
            leadId: match.id,
            direction: "INBOUND",
            body: msg.body,
            phone: normalizedFrom,
            provider: "quo",
            quoMessageId: msg.messageId,
            status: "DELIVERED",
          },
        });
        // Look up the lead's name for the push notification.
        const nameRow =
          match.type === "AD_LEAD"
            ? await prisma.adLead.findUnique({ where: { id: match.id }, select: { firstName: true, fullName: true } })
            : await prisma.quoteLead.findUnique({ where: { id: match.id }, select: { firstName: true } });
        const name =
          (nameRow as { firstName?: string | null } | null)?.firstName ||
          (nameRow as { fullName?: string | null } | null)?.fullName ||
          normalizedFrom;
        sendAdminPush({
          title: "💬 Lead replied",
          body: `${name}: ${msg.body.slice(0, 60)}`,
          url: `/admin/${match.path}/${match.id}`,
          tag: `lead-msg-${match.id}`,
        }).catch(console.error);
      }
    }
  }

  // Opt-out: a lead replied STOP → add to do-not-contact and archive every
  // lead with that phone. They're dead and can no longer be messaged.
  if (normalizedFrom && isOptOutMessage(msg.body)) {
    const keyword = msg.body.trim().toUpperCase().split(/\s+/)[0];
    await recordOptOut(normalizedFrom, keyword);
    const candidates = phoneCandidates(normalizedFrom);
    const results = await Promise.all([
      prisma.quoteLead.updateMany({ where: { phone: { in: candidates } }, data: { archived: true } }),
      prisma.adLead.updateMany({ where: { phone: { in: candidates } }, data: { archived: true } }),
      prisma.outOfAreaLead.updateMany({ where: { phone: { in: candidates } }, data: { archived: true } }),
      prisma.commercialLead.updateMany({ where: { phone: { in: candidates } }, data: { archived: true } }),
    ]);
    const archived = results.reduce((n, r) => n + r.count, 0);
    console.log(`[Quo] Opt-out (${keyword}) from ${normalizedFrom} — archived ${archived} lead(s)`);
    sendAdminPush({
      title: "🚫 Lead opted out (STOP)",
      body: `${normalizedFrom} replied ${keyword} — archived ${archived} lead${archived === 1 ? "" : "s"}`,
      url: "/admin/leads",
      tag: `optout-${normalizedFrom}`,
    }).catch(console.error);
  }

  // Reply forwarding (e.g. email a staffer).
  const { data: forwardRules } = await supabase
    .from("reply_forwarding_rules")
    .select("*")
    .eq("org_id", org.id)
    .eq("is_enabled", true);

  if (forwardRules && forwardRules.length > 0) {
    const { sendEmail, wrapEmailHtml } = await import("@/lib/resend");
    for (const rule of forwardRules) {
      if (rule.forward_to_type === "EMAIL" && rule.forward_to_value) {
        await sendEmail({
          to: rule.forward_to_value,
          subject: `New SMS from ${msg.from}`,
          html: wrapEmailHtml(`
            <p>You received a new SMS message:</p>
            <blockquote style="border-left: 4px solid #14b8a6; padding-left: 16px; margin: 16px 0;">
              ${msg.body}
            </blockquote>
            <p><strong>From:</strong> ${msg.from}</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/app/office/messages">View in Dashboard</a></p>
          `),
        }).catch((e) => console.error("[Quo] forward email failed:", e));
      }
    }
  }

  return NextResponse.json({ success: true, conversation_id: matchedConversationId });
}

async function handleDeliveryStatus(
  supabase: SupabaseClient,
  payload: unknown,
  status: string
) {
  const msg = parseInboundMessage(payload); // reuse: pulls id
  if (!msg.messageId) {
    return NextResponse.json({ success: true, skipped: "no message id" });
  }
  const nowIso = new Date().toISOString();

  await supabase.from("messages").update({ status }).eq("provider_id", msg.messageId);

  await supabase
    .from("notifications")
    .update({
      status,
      ...(status === "DELIVERED" ? { delivered_at: nowIso } : {}),
    })
    .eq("provider_id", msg.messageId);

  // Admin/CRM lead messages (Prisma) — same provider message id.
  await prisma.leadMessage.updateMany({ where: { quoMessageId: msg.messageId }, data: { status } });

  return NextResponse.json({ success: true, status });
}

// ── Calls → lead/client timeline (Phase 4) ──────────────────────────────────

/** Common stored formats for a US number so we can match raw-stored phones. */
function phoneCandidates(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length !== 10) return [e164];
  const a = ten.slice(0, 3), m = ten.slice(3, 6), l = ten.slice(6);
  return [`+1${ten}`, ten, `1${ten}`, `(${a}) ${m}-${l}`, `${a}-${m}-${l}`, `${a}.${m}.${l}`];
}

/** The external party's number on a call (the side that isn't our Quo number). */
function callExternalNumber(payload: unknown): string | null {
  const m = parseInboundMessage(payload); // from/to fields apply to calls too
  const our = normalizePhoneNumber(getQuoFromNumber());
  const from = normalizePhoneNumber(m.from);
  const to = normalizePhoneNumber(m.to);
  if (our && from === our) return to;
  if (our && to === our) return from;
  return from || to;
}

function callActivityText(event: string, payload: unknown): string {
  const obj = ((payload as { data?: Record<string, unknown> })?.data ?? payload) as Record<string, unknown>;
  switch (event) {
    case "call.missed":
      return "📞 Missed call";
    case "call.voicemail.completed":
      return "📞 Voicemail received";
    case "call.transcript.completed":
      return "📞 Call transcript available";
    case "call.summary.completed": {
      const s = obj.summary;
      const text = typeof s === "string" ? s : Array.isArray(s) ? s.join(" ") : "";
      return text ? `📞 Call summary: ${text}` : "📞 Call summary available";
    }
    case "call.completed": {
      const dur = obj.duration ? ` (${obj.duration}s)` : "";
      return `📞 Call completed${dur}`;
    }
    default:
      return `📞 Call event: ${event}`;
  }
}

async function handleCall(supabase: SupabaseClient, event: string, payload: unknown) {
  const external = callExternalNumber(payload);
  if (!external) return NextResponse.json({ success: true, skipped: "no external number" });
  const candidates = phoneCandidates(external);
  const text = callActivityText(event, payload);

  // 1) Client → log into the client's conversation timeline (shows in /office/messages).
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (org) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("org_id", org.id)
      .in("phone", candidates)
      .limit(1)
      .maybeSingle();

    if (client) {
      let convId: string | null = null;
      const { data: conv } = await supabase
        .from("message_conversations")
        .select("id")
        .eq("client_id", client.id)
        .eq("channel", "SMS")
        .eq("status", "OPEN")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (conv) {
        convId = conv.id;
      } else {
        const { data: nc } = await supabase
          .from("message_conversations")
          .insert({
            org_id: org.id,
            client_id: client.id,
            channel: "SMS",
            status: "OPEN",
            participant_our: getQuoFromNumber() || "",
            participant_their: external,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        convId = nc?.id ?? null;
      }
      if (convId) {
        await supabase.from("messages").insert({
          org_id: org.id,
          conversation_id: convId,
          direction: "INBOUND",
          body: text,
          status: "DELIVERED",
          provider: "quo",
          metadata: { type: "call", event },
        });
        await supabase
          .from("message_conversations")
          .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", convId);
      }
      return NextResponse.json({ success: true, matched: "client", client_id: client.id });
    }
  }

  // 2) Lead → LeadUpdate timeline entry (QuoteLead, then AdLead).
  const quote = await prisma.quoteLead.findFirst({ where: { phone: { in: candidates } }, select: { id: true } });
  if (quote) {
    await prisma.leadUpdate.create({
      data: { leadType: "QUOTE_FORM", leadId: quote.id, message: text, communicationType: "phone_call", adminEmail: "quo-webhook@system" },
    });
    return NextResponse.json({ success: true, matched: "quotelead", lead_id: quote.id });
  }
  const ad = await prisma.adLead.findFirst({ where: { phone: { in: candidates } }, select: { id: true } });
  if (ad) {
    await prisma.leadUpdate.create({
      data: { leadType: "AD_LEAD", leadId: ad.id, message: text, communicationType: "phone_call", adminEmail: "quo-webhook@system" },
    });
    return NextResponse.json({ success: true, matched: "adlead", lead_id: ad.id });
  }

  return NextResponse.json({ success: true, matched: "none", external });
}

// GET health-check / verification
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Quo webhook endpoint is active",
    endpoint: "/api/webhooks/quo",
  });
}
