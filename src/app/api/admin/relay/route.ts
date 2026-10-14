import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  relayConfig, relayHealth, relayDailyCap, relaySentToday, relayNumber, relayWebhookSecret, sendRelayText, setRelaySetting, RELAY_DEFAULT_NUMBER,
} from "@/lib/bluebubbles";
import { normalizePhoneNumber } from "@/lib/quo";

export const dynamic = "force-dynamic";

const keys = ["relay.url", "relay.number", "relay.enabled", "relay.fallbackToQuo", "relay.dailyCap", "relay.rampStart", "relay.lastSendAt", "relay.lastWebhookAt", "relay.lastEvent", "campaigns.textProvider"];

/** Relay settings + live health for the Campaigns page card. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  const cfg = await relayConfig();
  const [health, cap, sentToday] = await Promise.all([
    cfg ? relayHealth(cfg) : Promise.resolve({ ok: false, error: process.env.BLUEBUBBLES_PASSWORD ? "No server URL yet" : "BLUEBUBBLES_PASSWORD is not set in Vercel" }),
    relayDailyCap(),
    relaySentToday(),
  ]);
  const secret = relayWebhookSecret();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.vercel.app";
  return NextResponse.json({
    settings: { ...settings, "relay.number": settings["relay.number"] || RELAY_DEFAULT_NUMBER },
    passwordSet: !!process.env.BLUEBUBBLES_PASSWORD,
    health,
    cap,
    sentToday,
    webhookUrl: secret ? `${site}/api/webhooks/bluebubbles?secret=${secret}` : null,
  });
}

/** Save settings, or send a test text (`{ action: "test", to }`). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { action?: string; to?: string; settings?: Record<string, string> };

  if (b.action === "test") {
    const to = normalizePhoneNumber(b.to || "");
    if (!to) return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    const r = await sendRelayText({ to, body: `DooGoodScoopers iPhone relay test · ${new Date().toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" })}` });
    return NextResponse.json(r, { status: r.success ? 200 : 502 });
  }

  const s = b.settings || {};
  const updates: Record<string, string> = {};
  if (typeof s["relay.url"] === "string") {
    const url = s["relay.url"].trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//.test(url)) return NextResponse.json({ error: "Server URL must start with http:// or https://" }, { status: 400 });
    updates["relay.url"] = url;
  }
  if (typeof s["relay.number"] === "string") {
    const n = normalizePhoneNumber(s["relay.number"]);
    if (!n) return NextResponse.json({ error: "Enter the iPhone number as a 10-digit US number" }, { status: 400 });
    updates["relay.number"] = n;
  }
  for (const k of ["relay.enabled", "relay.fallbackToQuo"]) if (typeof s[k] === "string") updates[k] = s[k] === "true" ? "true" : "false";
  if (typeof s["relay.dailyCap"] === "string") {
    const v = s["relay.dailyCap"].trim();
    if (v && !(Number(v) > 0)) return NextResponse.json({ error: "Daily cap must be a number above zero, or blank for the warm-up ramp" }, { status: 400 });
    updates["relay.dailyCap"] = v ? String(Math.round(Number(v))) : "";
  }
  if (typeof s["campaigns.textProvider"] === "string") updates["campaigns.textProvider"] = s["campaigns.textProvider"] === "iphone" ? "iphone" : "quo";
  // The warm-up ramp counts from the day the relay first goes live.
  if (updates["relay.enabled"] === "true") {
    const ramp = await prisma.appSetting.findUnique({ where: { key: "relay.rampStart" } });
    if (!ramp?.value) updates["relay.rampStart"] = new Date().toISOString();
  }
  await Promise.all(Object.entries(updates).map(([k, v]) => setRelaySetting(k, v)));
  return NextResponse.json({ success: true, number: await relayNumber() });
}
