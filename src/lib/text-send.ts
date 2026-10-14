/**
 * Where a campaign text goes out from: the Quo office line or the iPhone relay.
 *
 * Campaign.channel values:
 *   "sms"       the default text channel → whatever Campaigns settings say (campaigns.textProvider)
 *   "iphone"    always the iPhone number (BlueBubbles relay)
 *   "quo"       always the Quo office line
 *   "messenger" Messenger first, then the default text channel, then email
 *
 * The iPhone path is paced (daily cap + spacing, see bluebubbles.ts). When it
 * isn't allowed right now the caller leaves the message queued; nothing falls
 * back to Quo just because of pacing. A relay FAILURE does fall back to Quo
 * when relay.fallbackToQuo is on.
 */

import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured, type SendSmsResult } from "@/lib/quo";
import { relayConfig, relayAllowance, sendRelayText, type RelayAllowance } from "@/lib/bluebubbles";
import type { TextProvider } from "@/lib/inbound-text";

export type { TextProvider };

export const PROVIDER_LABEL: Record<TextProvider, string> = { quo: "Quo office line", iphone: "iPhone" };

/** The default provider for campaign texts (Campaigns → Text sending). */
export async function defaultTextProvider(): Promise<TextProvider> {
  const row = await prisma.appSetting.findUnique({ where: { key: "campaigns.textProvider" } });
  return row?.value === "iphone" ? "iphone" : "quo";
}

/** Resolves a campaign's channel to the provider its text steps use. */
export async function campaignTextProvider(channel: string | null | undefined): Promise<TextProvider> {
  if (channel === "iphone") return "iphone";
  if (channel === "quo") return "quo";
  return defaultTextProvider();
}

export interface CampaignTextResult extends SendSmsResult {
  /** The provider that actually carried the message (after any fallback). */
  provider: TextProvider;
  /** True when the relay was asked but pacing said "not now" — nothing was sent. */
  deferred?: boolean;
  deferReason?: string;
}

/**
 * Sends one campaign text through the chosen provider.
 * `allowance` lets a cron reuse one pacing check across a run (and mark it used).
 */
export async function sendCampaignText(opts: {
  to: string;
  body: string;
  provider: TextProvider;
  allowance?: { current: RelayAllowance | null; used: boolean };
}): Promise<CampaignTextResult> {
  if (opts.provider === "iphone") {
    const cfg = await relayConfig();
    const live = !!cfg && cfg.enabled;
    if (live) {
      // Pacing: one relay send per cron run, under today's cap, spaced out.
      const a = opts.allowance;
      let allowance = a?.current ?? null;
      if (!allowance) {
        allowance = await relayAllowance();
        if (a) a.current = allowance;
      }
      if (!allowance.ok || a?.used) {
        return { success: false, provider: "iphone", deferred: true, deferReason: a?.used ? "one relay send per run" : allowance.reason, error: "deferred" };
      }
      if (a) a.used = true;
      const r = await sendRelayText({ to: opts.to, body: opts.body });
      if (r.success) return { ...r, provider: "iphone" };
      if (!cfg!.fallbackToQuo || !isQuoConfigured()) return { ...r, provider: "iphone" };
      const q = await sendSms({ to: opts.to, body: opts.body });
      return { ...q, provider: "quo", error: q.success ? undefined : `${q.error} (after iPhone relay failed: ${r.error})` };
    }
    // Relay not set up (or switched off): Quo if allowed, otherwise a clear failure.
    if (cfg?.fallbackToQuo !== false && isQuoConfigured()) {
      const q = await sendSms({ to: opts.to, body: opts.body });
      return { ...q, provider: "quo" };
    }
    return { success: false, provider: "iphone", error: cfg ? "iPhone relay is switched off" : "iPhone relay not configured" };
  }
  if (!isQuoConfigured()) return { success: false, provider: "quo", error: "Quo not configured" };
  const q = await sendSms({ to: opts.to, body: opts.body });
  return { ...q, provider: "quo" };
}
