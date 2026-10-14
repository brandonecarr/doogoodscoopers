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
import type { SupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { processInboundText, applyDeliveryStatus, captureOutboundText, getServiceSupabase, phoneCandidates } from "@/lib/inbound-text";
import {
  verifyQuoWebhook,
  parseInboundMessage,
  quoEventType,
  normalizePhoneNumber,
  getQuoFromNumber,
} from "@/lib/quo";
import { analyzeCallSmart, applyCallIntel, applyCommercialCallIntel, isCallIntelConfigured } from "@/lib/call-intel";

const getSupabase = (): SupabaseClient => getServiceSupabase();

// Resolve a Quo delivery event + payload into one of our allowed
// messages.status CHECK values (DELIVERED | FAILED | SENT), or null to ignore.
// Robust to event-name variance: "undelivered", "failed", "error", "rejected"
// all count as a failure, whether they arrive as the event name or the payload's
// own `status` field. (Quo reports carrier rejections as status "undelivered",
// which previously fell through unmapped and left the message stuck at "sent".)
function resolveDeliveryStatus(event: string, payload: unknown): string | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const d = (p.data && typeof p.data === "object" ? (p.data as Record<string, unknown>) : p);
  const obj = d.object && typeof d.object === "object" ? (d.object as Record<string, unknown>) : d;
  const payloadStatus = typeof obj.status === "string" ? obj.status : "";
  const raw = `${payloadStatus} ${event}`.toLowerCase();

  if (/(undeliver|fail|error|reject|invalid)/.test(raw)) return "FAILED";
  if (/deliver/.test(raw)) return "DELIVERED"; // "delivered" (undelivered already returned above)
  if (/sent/.test(raw)) return "SENT";
  return null;
}

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

    // Any other message.* event is about a message WE sent. It's a delivery-status
    // update, and/or the first we're hearing of an outbound message composed in the
    // Quo app (not through the CRM) — capture that into the lead's thread so the
    // owner's own replies show up here too.
    if (event.startsWith("message.")) {
      const status = resolveDeliveryStatus(event, payload);
      await captureOutboundFromQuo(payload, status).catch((e) =>
        console.error("[Quo] outbound capture failed:", e)
      );
      if (!status) return NextResponse.json({ success: true, ignored: true, event });
      return await handleDeliveryStatus(supabase, payload, status);
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

async function handleInbound(_supabase: SupabaseClient, payload: unknown) {
  const msg = parseInboundMessage(payload);
  const r = await processInboundText({
    provider: "quo",
    ourNumber: getQuoFromNumber(),
    from: msg.from,
    to: msg.to,
    body: msg.body,
    messageId: msg.messageId,
    mediaUrls: msg.mediaUrls,
    rawPayload: payload,
  });
  return NextResponse.json({ success: true, ...(r.skipped ? { skipped: true } : { conversation_id: r.conversationId ?? null }) });
}

async function handleDeliveryStatus(_supabase: SupabaseClient, payload: unknown, status: string) {
  const msg = parseInboundMessage(payload); // reuse: pulls id
  if (!msg.messageId) {
    return NextResponse.json({ success: true, skipped: "no message id" });
  }
  const { dripStopped } = await applyDeliveryStatus(msg.messageId, status);
  return NextResponse.json({ success: true, status, dripStopped });
}

/**
 * Capture an OUTBOUND message that was sent from the Quo app (not through the CRM)
 * so the owner's own replies land in the lead's thread. Outbound = the payload says
 * so, or the sender is our own Quo number.
 */
async function captureOutboundFromQuo(payload: unknown, status: string | null) {
  const msg = parseInboundMessage(payload);
  if (!msg.messageId) return;
  const dir = (msg.direction || "").toLowerCase();
  const our = normalizePhoneNumber(getQuoFromNumber());
  const fromOurs = !!our && normalizePhoneNumber(msg.from) === our;
  const isOutbound = /out/.test(dir) || (!/in/.test(dir) && fromOurs);
  if (!isOutbound) return;
  await captureOutboundText({ provider: "quo", to: msg.to, body: msg.body, messageId: msg.messageId }, status);
}

// ── Calls → lead/client timeline (Phase 4) ──────────────────────────────────

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

/** Quo's call id off a call.* webhook payload. */
function callIdFromPayload(payload: unknown): string | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const d = p.data && typeof p.data === "object" ? (p.data as Record<string, unknown>) : p;
  const obj = d.object && typeof d.object === "object" ? (d.object as Record<string, unknown>) : d;
  return (obj.callId as string) || (obj.id as string) || null;
}

/**
 * AI call notes. When Quo finishes transcribing a call, pull the transcript,
 * extract what the caller told us, and write it into the matching lead (filling
 * blanks only) — or create a lead for an unknown caller. Returns null to fall
 * back to the plain timeline entry when the AI is off or has nothing to add.
 */
async function handleCallTranscript(payload: unknown) {
  if (!isCallIntelConfigured()) {
    console.warn("[call-ai] skipped — ANTHROPIC_API_KEY not set");
    return null;
  }
  const setting = await prisma.appSetting.findUnique({ where: { key: "calls.ai.enabled" } });
  if (setting?.value === "false") {
    console.warn("[call-ai] skipped — calls.ai.enabled is false");
    return null;
  }

  const callId = callIdFromPayload(payload);
  if (!callId) {
    console.warn("[call-ai] skipped — no callId in payload:", JSON.stringify(payload).slice(0, 300));
    return null;
  }

  try {
    // Prefer the number carried on the payload (when present); otherwise the
    // transcript's speaker identifiers reveal it. The number decides which
    // extraction runs: commercial leads and call-list prospects get the
    // commercial one, everyone else the residential one.
    const analyzed = await analyzeCallSmart(callId, callExternalNumber(payload));
    if (!analyzed) {
      console.warn(`[call-ai] ${callId} skipped — no transcript returned by Quo`);
      return null;
    }
    const external = callExternalNumber(payload) || analyzed.externalNumber;
    if (!external) {
      console.warn(`[call-ai] ${callId} skipped — could not determine the caller's number`);
      return null;
    }
    if (!analyzed.result.ok) {
      console.warn(`[call-ai] ${callId} skipped — ${analyzed.result.reason}: ${analyzed.result.message}`);
      return null; // fall through to the plain timeline entry
    }
    const result = analyzed.kind === "commercial"
      ? await applyCommercialCallIntel({ phone: external, intel: analyzed.result.intel, callId, match: analyzed.match })
      : await applyCallIntel({ phone: external, intel: analyzed.result.intel, callId });
    console.log(`[call-ai] ${callId} (${external}, ${analyzed.kind}) → ${result.action} ${result.fieldsFilled.join(",")}`);
    return NextResponse.json({ success: true, callAi: result });
  } catch (e) {
    console.error("[call-ai] failed:", e);
    return null; // fall through to the plain timeline entry
  }
}

async function handleCall(supabase: SupabaseClient, event: string, payload: unknown) {
  // Transcript ready → run AI extraction. This MUST come before the
  // external-number check below: Quo's transcript payload carries only
  // callId/createdAt/dialogue (no from/to), so callExternalNumber() returns null
  // for it and we would bail before ever extracting. handleCallTranscript
  // recovers the caller from the transcript's own speaker identifiers instead.
  if (event === "call.transcript.completed") {
    const handled = await handleCallTranscript(payload);
    if (handled) return handled;
  }

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
