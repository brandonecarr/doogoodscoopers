/**
 * Provider-neutral handling of texts, shared by the Quo and BlueBubbles (iPhone)
 * webhooks:
 *   - processInboundText   a reply from a lead/client → inbox thread, lead timeline,
 *                          stop-on-reply, STOP opt-out, push alerts, reply forwarding
 *   - applyDeliveryStatus  delivered/failed → messages, notifications, lead timeline,
 *                          and stop a drip whose number bounced
 *   - captureOutboundText  a text the owner typed in the provider's own app → the
 *                          lead's thread, so it shows next to the CRM's own sends
 *
 * Lifted out of the Quo webhook unchanged in behavior; the provider name only
 * labels rows and log lines. `messageId` must be unique per provider message.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { sendAdminPush } from "@/lib/web-push";
import { isOptOutMessage, recordOptOut } from "@/lib/sms-optout";
import { normalizePhoneNumber } from "@/lib/quo";

export type TextProvider = "quo" | "iphone";

export interface InboundText {
  provider: TextProvider;
  /** Our number on this provider (E.164), for the conversation's participant_our. */
  ourNumber: string;
  from: string;
  to: string;
  body: string;
  messageId: string;
  mediaUrls?: string[];
  rawPayload?: unknown;
}

export interface OutboundCapture {
  provider: TextProvider;
  to: string;
  body: string;
  messageId: string;
}

export function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase environment variables not configured");
  return createClient(url, serviceKey);
}

/** Common stored formats for a US number so we can match raw-stored phones. */
export function phoneCandidates(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length !== 10) return [e164];
  const a = ten.slice(0, 3), m = ten.slice(3, 6), l = ten.slice(6);
  return [`+1${ten}`, ten, `1${ten}`, `(${a}) ${m}-${l}`, `${a}-${m}-${l}`, `${a}.${m}.${l}`];
}

const tag = (p: TextProvider) => (p === "iphone" ? "[iPhone]" : "[Quo]");

/** The lead a phone number belongs to: the active thread first, then the newest QuoteLead, then AdLead. */
export async function leadForPhone(candidates: string[]): Promise<{ type: LeadSource; id: string; path: string } | null> {
  const thread = await prisma.leadMessage.findFirst({
    where: { phone: { in: candidates } },
    orderBy: { createdAt: "desc" },
    select: { leadType: true, leadId: true },
  });
  if (thread) return { type: thread.leadType, id: thread.leadId, path: thread.leadType === "AD_LEAD" ? "ad-leads" : "quote-leads" };
  const quote = await prisma.quoteLead.findFirst({ where: { phone: { in: candidates } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (quote) return { type: "QUOTE_FORM", id: quote.id, path: "quote-leads" };
  const adl = await prisma.adLead.findFirst({ where: { phone: { in: candidates } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (adl) return { type: "AD_LEAD", id: adl.id, path: "ad-leads" };
  return null;
}

export async function processInboundText(msg: InboundText): Promise<{ success: boolean; conversationId?: string | null; skipped?: boolean; duplicate?: boolean }> {
  const supabase = getServiceSupabase();
  const normalizedFrom = normalizePhoneNumber(msg.from);
  const mediaUrls = msg.mediaUrls ?? [];

  // Single-tenant: default org.
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) {
    console.error(`${tag(msg.provider)} No organization found`);
    return { success: true, skipped: true };
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
            participant_our: msg.ourNumber || msg.to,
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
    provider: msg.provider,
    provider_id: msg.messageId,
    matched_client_id: matchedClientId,
    matched_conversation_id: matchedConversationId,
    processed: !!matchedConversationId,
    raw_payload: (msg.rawPayload as object) ?? {},
  });

  // Thread the message and bump the conversation.
  if (matchedConversationId) {
    await supabase.from("messages").insert({
      org_id: org.id,
      conversation_id: matchedConversationId,
      direction: "INBOUND",
      body: msg.body,
      status: "DELIVERED", // inbound is received; RECEIVED is not a valid status value
      provider: msg.provider,
      provider_id: msg.messageId,
      metadata: mediaUrls.length ? { mediaUrls } : {},
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

  // A converted Sweep&Go customer texting is NOT a lead. Their old prospect lead
  // should already be archived at conversion (sync-customers), but guard here too:
  // never fire a "Lead replied" alert — or match a stale lead — for a real customer.
  let isKnownCustomer = false;
  if (!matchedClientId && normalizedFrom) {
    const cand = phoneCandidates(normalizedFrom);
    const customer = await prisma.sweepandgoCustomer.findFirst({
      where: { active: true, OR: [{ cellPhone: { in: cand } }, { homePhone: { in: cand } }] },
      select: { id: true },
    });
    isKnownCustomer = !!customer;
  }

  // No client/customer match → attach the reply to a LEAD (the /admin CRM). Matches
  // QuoteLead first, then AdLead, by phone; logs a LeadMessage + notifies admins.
  if (!matchedClientId && !isKnownCustomer && normalizedFrom && msg.messageId) {
    const already = await prisma.leadMessage.findUnique({ where: { quoMessageId: msg.messageId } });
    if (!already) {
      const candidates = phoneCandidates(normalizedFrom);
      // Prefer the lead we're already conversing with on this phone (the most
      // recent existing message thread), so a reply joins the active
      // conversation instead of landing on a stale duplicate lead. Fall back to
      // the most-recently-created lead for the phone.
      const match = await leadForPhone(candidates);

      if (match) {
        await prisma.leadMessage.create({
          data: {
            leadType: match.type,
            leadId: match.id,
            direction: "INBOUND",
            body: msg.body,
            phone: normalizedFrom,
            provider: msg.provider,
            quoMessageId: msg.messageId,
            status: "DELIVERED",
          },
        });
        // A reply ends any active stop-on-reply drip for this lead — immediately,
        // instead of waiting for the next scheduled step to come due.
        const activeRecs = await prisma.campaignRecipient.findMany({
          where: { leadType: match.type, leadId: match.id, status: "ACTIVE" },
          select: { id: true, campaignId: true },
        });
        if (activeRecs.length) {
          const stopCampaigns = await prisma.campaign.findMany({
            where: { id: { in: activeRecs.map((r) => r.campaignId) }, type: "DRIP", stopOnReply: true },
            select: { id: true },
          });
          const stopSet = new Set(stopCampaigns.map((c) => c.id));
          const stopIds = activeRecs.filter((r) => stopSet.has(r.campaignId)).map((r) => r.id);
          if (stopIds.length) {
            await prisma.campaignRecipient.updateMany({
              where: { id: { in: stopIds } },
              data: { status: "STOPPED", error: "lead replied", nextSendAt: null },
            });
          }
        }
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
  // (Carriers handle STOP for a Quo line; for the iPhone this is the ONLY handling.)
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
    console.log(`${tag(msg.provider)} Opt-out (${keyword}) from ${normalizedFrom} — archived ${archived} lead(s)`);
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
          subject: `New ${msg.provider === "iphone" ? "iMessage/SMS" : "SMS"} from ${msg.from}`,
          html: wrapEmailHtml(`
            <p>You received a new text message:</p>
            <blockquote style="border-left: 4px solid #14b8a6; padding-left: 16px; margin: 16px 0;">
              ${msg.body}
            </blockquote>
            <p><strong>From:</strong> ${msg.from}</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/app/office/messages">View in Dashboard</a></p>
          `),
        }).catch((e) => console.error(`${tag(msg.provider)} forward email failed:`, e));
      }
    }
  }

  return { success: true, conversationId: matchedConversationId };
}

/** DELIVERED | FAILED | SENT for a message we sent, by provider message id. */
export async function applyDeliveryStatus(messageId: string, status: string): Promise<{ dripStopped: number }> {
  const supabase = getServiceSupabase();
  const nowIso = new Date().toISOString();

  await supabase.from("messages").update({ status }).eq("provider_id", messageId);

  await supabase
    .from("notifications")
    .update({ status, ...(status === "DELIVERED" ? { delivered_at: nowIso } : {}) })
    .eq("provider_id", messageId);

  // Admin/CRM lead messages (Prisma) — same provider message id.
  await prisma.leadMessage.updateMany({ where: { quoMessageId: messageId }, data: { status } });

  // A failed/undelivered send ends the drip for that lead: there's no point
  // firing the remaining steps at a number the carrier won't deliver to.
  let dripStopped = 0;
  if (status === "FAILED") {
    const leadMsgs = await prisma.leadMessage.findMany({ where: { quoMessageId: messageId }, select: { leadType: true, leadId: true } });
    for (const lm of leadMsgs) {
      const active = await prisma.campaignRecipient.findMany({
        where: { leadType: lm.leadType, leadId: lm.leadId, status: "ACTIVE" },
        select: { id: true, campaignId: true },
      });
      if (!active.length) continue;
      const dripCampaigns = await prisma.campaign.findMany({ where: { id: { in: active.map((r) => r.campaignId) }, type: "DRIP" }, select: { id: true } });
      const dripSet = new Set(dripCampaigns.map((c) => c.id));
      const stopIds = active.filter((r) => dripSet.has(r.campaignId)).map((r) => r.id);
      if (stopIds.length) {
        const res = await prisma.campaignRecipient.updateMany({
          where: { id: { in: stopIds } },
          data: { status: "STOPPED", error: "undeliverable (carrier rejected)", nextSendAt: null },
        });
        dripStopped += res.count;
      }
    }
  }
  return { dripStopped };
}

/**
 * Records a text the owner sent from the provider's own app (the Quo app, or the
 * iPhone/Mac Messages app) so it lands in the lead's thread. No-ops when we already
 * have the message (sent through the CRM), it has no body, or nobody matches.
 */
export async function captureOutboundText(out: OutboundCapture, status: string | null): Promise<boolean> {
  if (!out.messageId) return false;
  const existing = await prisma.leadMessage.findUnique({ where: { quoMessageId: out.messageId } });
  if (existing) return false;
  const body = (out.body || "").trim();
  if (!body) return false;
  const toPhone = normalizePhoneNumber(out.to);
  if (!toPhone) return false;
  const match = await leadForPhone(phoneCandidates(toPhone));
  if (!match) return false;
  try {
    await prisma.leadMessage.create({
      data: {
        leadType: match.type,
        leadId: match.id,
        direction: "OUTBOUND",
        body,
        phone: toPhone,
        provider: out.provider,
        quoMessageId: out.messageId,
        status: status || "SENT",
      },
    });
    return true;
  } catch (e) {
    // Unique-constraint race (a concurrent event just created it) — safe to ignore.
    console.warn(`${tag(out.provider)} outbound capture skipped:`, (e as Error).message);
    return false;
  }
}
