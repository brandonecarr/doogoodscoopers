import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";

/**
 * Locally-tracked Quo messaging balance.
 *
 * Quo's API exposes no billing endpoint, so we can't read the real balance.
 * Instead the owner seeds it from the Quo dashboard and we decrement on every
 * message that actually leaves. That makes this an ESTIMATE that drifts from
 * Quo's true figure over time — the UI lets you re-sync it whenever you top up.
 *
 * Stored in AppSetting so there's no extra table:
 *   sms.balance.amount          current balance, dollars
 *   sms.balance.lowThreshold    warn at or below this
 *   sms.balance.costPerSegment  charged per SMS segment
 */

const KEY_AMOUNT = "sms.balance.amount";
const KEY_LOW = "sms.balance.lowThreshold";
const KEY_COST = "sms.balance.costPerSegment";

const DEFAULT_LOW = 3;
const DEFAULT_COST = 0.01;

export interface SmsBalance {
  amount: number;
  lowThreshold: number;
  costPerSegment: number;
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

export async function getSmsBalance(): Promise<SmsBalance> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "sms.balance." } } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    amount: num(m[KEY_AMOUNT], 0),
    lowThreshold: num(m[KEY_LOW], DEFAULT_LOW),
    costPerSegment: num(m[KEY_COST], DEFAULT_COST),
  };
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/**
 * SMS segment count. GSM-7 fits 160 chars in one segment (153 each when split);
 * anything with non-GSM characters (emoji, curly quotes) switches the whole
 * message to UCS-2 at 70 / 67. Carriers bill per segment, so a stray emoji can
 * more than double the cost of a message.
 */
export function segmentsFor(body: string): number {
  const text = body ?? "";
  if (!text) return 1;
  // Conservative GSM-7 set; anything outside it forces UCS-2.
  const gsm = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;
  const isGsm = gsm.test(text);
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

/**
 * Charge the balance for one outgoing message and warn when it runs low.
 * Never throws — a bookkeeping problem must not break sending.
 */
export async function chargeForMessage(body: string): Promise<void> {
  try {
    const { lowThreshold, costPerSegment } = await getSmsBalance();
    const cost = segmentsFor(body) * costPerSegment;

    // Atomic decrement so concurrent sends can't clobber each other.
    await prisma.$executeRaw`
      INSERT INTO "AppSetting"("key","value","createdAt","updatedAt")
      VALUES (${KEY_AMOUNT}, ${(-cost).toFixed(4)}, now(), now())
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (COALESCE(NULLIF("AppSetting"."value",'')::numeric, 0) - ${cost}::numeric)::text,
            "updatedAt" = now();`;

    const { amount } = await getSmsBalance();
    if (amount <= 0) {
      await notify({
        type: "credits",
        severity: "error",
        title: "Your Quo balance is empty",
        body: `Tracked balance is $${amount.toFixed(2)}. Messages will start failing — add credits in Quo, then update the balance here.`,
        link: "/admin/campaigns",
        dedupeKey: "sms:balance:empty",
        push: true,
      });
    } else if (amount <= lowThreshold) {
      await notify({
        type: "credits",
        severity: "warning",
        title: `Quo balance is low: $${amount.toFixed(2)}`,
        body: `At about $${costPerSegment.toFixed(3)} per message that's roughly ${Math.floor(
          amount / costPerSegment
        )} more messages. Top up in Quo, then update the balance here.`,
        link: "/admin/campaigns",
        dedupeKey: "sms:balance:low",
        push: true,
      });
    }
  } catch (e) {
    console.error("[sms-balance] charge failed:", e);
  }
}

/** Add to the balance after topping up in Quo. Returns the new balance. */
export async function addFunds(delta: number): Promise<number> {
  const { amount } = await getSmsBalance();
  const next = Math.round((amount + delta) * 100) / 100;
  await setSetting(KEY_AMOUNT, String(next));
  await clearBalanceAlerts(next);
  return next;
}

/** Overwrite the balance to match what Quo actually shows. */
export async function setBalance(amount: number): Promise<number> {
  const next = Math.round(amount * 100) / 100;
  await setSetting(KEY_AMOUNT, String(next));
  await clearBalanceAlerts(next);
  return next;
}

export async function setBalanceConfig(opts: { lowThreshold?: number; costPerSegment?: number }) {
  if (opts.lowThreshold !== undefined) await setSetting(KEY_LOW, String(opts.lowThreshold));
  if (opts.costPerSegment !== undefined) await setSetting(KEY_COST, String(opts.costPerSegment));
}

/** Once funded again, retire the low/empty alerts so they can fire fresh later. */
async function clearBalanceAlerts(next: number) {
  const { lowThreshold } = await getSmsBalance();
  if (next > lowThreshold) {
    await prisma.adminNotification
      .deleteMany({ where: { dedupeKey: { in: ["sms:balance:low", "sms:balance:empty", "quo:no-credits"] } } })
      .catch(() => {});
  }
}
