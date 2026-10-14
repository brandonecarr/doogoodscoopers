/**
 * BlueBubbles (iPhone relay) webhook
 *
 * The BlueBubbles Server on the office Mac mini POSTs here. Events we use:
 *   new-message         isFromMe=false → a reply (same handling as a Quo reply:
 *                       thread, lead timeline, stop-on-reply, STOP, push alert)
 *                       isFromMe=true  → a text typed on the iPhone/Mac → lead thread
 *   updated-message     delivered / read / errored → delivery status
 *   message-send-error  → FAILED
 *   new-server          the tunnel URL changed → relay.url follows it
 *   hello-world         the server's test button
 *
 * Auth: `?secret=` must match BLUEBUBBLES_WEBHOOK_SECRET (or the password-derived
 * default). Group chats are ignored; only one-to-one threads reach the CRM.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseRelayEvent, relayNumber, relayWebhookSecret, setRelaySetting } from "@/lib/bluebubbles";
import { processInboundText, applyDeliveryStatus, captureOutboundText } from "@/lib/inbound-text";
import { normalizePhoneNumber } from "@/lib/quo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request: NextRequest): boolean {
  const expected = relayWebhookSecret();
  if (!expected) return false;
  const given = new URL(request.url).searchParams.get("secret") || request.headers.get("x-webhook-secret") || "";
  return given.length === expected.length && given === expected;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : "";
  console.log(`[iPhone] Event: ${type}`);
  await setRelaySetting("relay.lastWebhookAt", new Date().toISOString()).catch(() => {});
  await setRelaySetting("relay.lastEvent", type || "unknown").catch(() => {});

  try {
    // The built-in Cloudflare tunnel gets a new URL on restart; follow it.
    if (type === "new-server" || type === "server-url-change") {
      const url = typeof p.data === "string" ? p.data : typeof (p.data as Record<string, unknown>)?.url === "string" ? ((p.data as Record<string, unknown>).url as string) : "";
      if (/^https?:\/\//.test(url)) {
        await setRelaySetting("relay.url", url.replace(/\/+$/, ""));
        console.log(`[iPhone] Relay URL updated to ${url}`);
        return NextResponse.json({ success: true, url });
      }
      return NextResponse.json({ success: true, ignored: true, type });
    }
    if (type === "hello-world") return NextResponse.json({ success: true, hello: true });

    const ev = parseRelayEvent(payload);
    if (!ev) return NextResponse.json({ success: true, ignored: true, type });
    if (ev.isGroup) return NextResponse.json({ success: true, ignored: "group chat" });

    const ours = await relayNumber();
    const other = normalizePhoneNumber(ev.address) || ev.address;

    if (type === "new-message") {
      if (ev.isFromMe) {
        // Our own send (already recorded by its GUID) or a text typed on the iPhone/Mac.
        const captured = await captureOutboundText({ provider: "iphone", to: other, body: ev.text, messageId: ev.guid }, ev.error ? "FAILED" : "SENT");
        return NextResponse.json({ success: true, outbound: true, captured });
      }
      if (!ev.text.trim() && !ev.hasAttachments) return NextResponse.json({ success: true, ignored: "empty" });
      const r = await processInboundText({
        provider: "iphone",
        ourNumber: ours,
        from: other,
        to: ours,
        body: ev.text || (ev.hasAttachments ? "[attachment]" : ""),
        messageId: ev.guid,
        rawPayload: payload,
      });
      return NextResponse.json({ success: true, conversation_id: r.conversationId ?? null });
    }

    if (type === "updated-message" || type === "message-send-error" || /error/.test(type)) {
      if (!ev.isFromMe && type === "updated-message") return NextResponse.json({ success: true, ignored: "inbound update" });
      const status = ev.error || type !== "updated-message" ? "FAILED" : ev.delivered || ev.read ? "DELIVERED" : null;
      if (!status) return NextResponse.json({ success: true, ignored: "no status change" });
      const { dripStopped } = await applyDeliveryStatus(ev.guid, status);
      return NextResponse.json({ success: true, status, dripStopped });
    }

    return NextResponse.json({ success: true, ignored: true, type });
  } catch (error) {
    console.error("[iPhone] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: "Failed to process webhook" }, { status: 500 });
  }
}

/** BlueBubbles' "test" button sends a GET; answer so the owner sees it worked. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ success: true, listening: true });
}
