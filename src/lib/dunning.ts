import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { sendEmail, wrapEmailHtml } from "@/lib/resend";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { isWithinSendWindow, loadSendWindow } from "@/lib/send-window";
import { getSetting, setSetting } from "@/lib/google-business";
import { notify } from "@/lib/notify";
import { fmtMoney, customerNameKey } from "@/lib/sweepandgo-billing";

/**
 * Failed-payment recovery ("dunning").
 *
 * Non-payment silently cancelled 4 subscriptions in the last year — customers
 * who never chose to leave, they just had a card decline. Sweep&Go retries the
 * card but nobody tells the customer, so the first thing they notice is the
 * service stopping.
 *
 * Signal: an invoice with money still owed. Sweep&Go also sets
 * `next_try_charging` when a card was declined and a retry is queued, which
 * distinguishes "the card failed" from "invoice just issued".
 *
 * ⚠️ Customer messaging is OFF until `dunning.enabled` is set. Until then this
 * still runs and still alerts the owner — it just never texts anyone.
 */

const ENABLED_KEY = "dunning.enabled";
const PAYLINK_KEY = "dunning.payLink";
const LAST_RUN_KEY = "dunning.lastRun";

/** Days to wait before the next nudge, indexed by the stage just sent. */
const STAGE_GAP_DAYS = [0, 3, 4];
const MAX_STAGE = 3;
/** Ignore ancient unpaid invoices — chasing a year-old balance by text is noise. */
const LOOKBACK_DAYS = 90;

export interface DunningResult {
  enabled: boolean;
  atRisk: number;
  messaged: number;
  recovered: number;
  skipped: string[];
  error?: string;
}

function firstNameOf(full: string): string {
  return (full || "").trim().split(/\s+/)[0] || "there";
}

function message(stage: number, first: string, amount: string, payLink: string): string {
  const fix = payLink
    ? `You can update it here: ${payLink}`
    : `Just reply here and I'll get it sorted.`;
  if (stage <= 1) {
    return `Hey ${first}, it's Brandon with DooGoodScoopers. Heads up — the card on file didn't go through for your last invoice (${amount}). Mind updating it when you get a sec? ${fix}`;
  }
  if (stage === 2) {
    return `Hey ${first}, just circling back — I'm still seeing ${amount} outstanding on your account. ${fix}`;
  }
  return `Hi ${first}, last note from me on this one. There's still ${amount} owed and I'd hate for your service to lapse over a card issue. ${fix}`;
}

export async function runDunning(): Promise<DunningResult> {
  const [enabledRaw, payLink] = await Promise.all([
    getSetting(ENABLED_KEY).catch(() => null),
    getSetting(PAYLINK_KEY).catch(() => null),
  ]);
  const enabled = enabledRaw === "true";
  const skipped: string[] = [];

  // 1) Anything previously chased that has since been paid → close it out.
  const recoveredRows = await prisma.sngInvoice.findMany({
    where: { dunningStage: { gt: 0 }, dunningResolvedAt: null, remainingCents: { lte: 0 } },
    select: { id: true, clientName: true, totalCents: true },
  });
  if (recoveredRows.length) {
    await prisma.sngInvoice.updateMany({
      where: { id: { in: recoveredRows.map((r) => r.id) } },
      data: { dunningResolvedAt: new Date() },
    });
    for (const r of recoveredRows) {
      await notify({
        type: "system",
        severity: "info",
        title: "💰 Failed payment recovered",
        body: `${r.clientName || "A customer"} paid ${fmtMoney(r.totalCents)}.`,
        push: false,
      }).catch(() => {});
    }
  }

  // 2) Outstanding balances worth chasing.
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const atRisk = await prisma.sngInvoice.findMany({
    where: {
      remainingCents: { gt: 0 },
      dunningResolvedAt: null,
      dunningStage: { lt: MAX_STAGE },
      sngCreatedAt: { gte: since },
    },
    orderBy: { sngCreatedAt: "asc" },
    take: 100,
  });

  if (atRisk.length === 0) {
    await setSetting(LAST_RUN_KEY, `${new Date().toISOString()} atRisk=0 messaged=0 recovered=${recoveredRows.length}`).catch(() => {});
    return { enabled, atRisk: 0, messaged: 0, recovered: recoveredRows.length, skipped };
  }

  // Always tell the owner, even when customer messaging is off.
  const owed = atRisk.reduce((n, i) => n + i.remainingCents, 0);
  await notify({
    type: "system",
    severity: atRisk.length > 3 ? "warning" : "info",
    // One standing alert that refreshes, rather than a new row every run.
    dedupeKey: "dunning-outstanding",
    title: `⚠️ ${atRisk.length} unpaid invoice${atRisk.length === 1 ? "" : "s"}`,
    body: `${fmtMoney(owed)} outstanding${enabled ? "" : " — auto-texts are off, so nobody has been contacted"}.`,
    link: "/admin/campaigns",
    push: true,
  }).catch(() => {});

  if (!enabled) {
    await setSetting(LAST_RUN_KEY, `${new Date().toISOString()} atRisk=${atRisk.length} messaged=0 (disabled) recovered=${recoveredRows.length}`).catch(() => {});
    return { enabled, atRisk: atRisk.length, messaged: 0, recovered: recoveredRows.length, skipped: ["customer messaging disabled"] };
  }

  // Only text people during sending hours.
  const window = await loadSendWindow();
  if (!isWithinSendWindow(new Date(), window)) {
    return { enabled, atRisk: atRisk.length, messaged: 0, recovered: recoveredRows.length, skipped: ["outside sending hours"] };
  }

  const optedOut = await optedOutKeys();
  let messaged = 0;

  for (const inv of atRisk) {
    // Respect the gap since the last nudge.
    const gapDays = STAGE_GAP_DAYS[Math.min(inv.dunningStage, STAGE_GAP_DAYS.length - 1)];
    if (inv.dunningLastAt && Date.now() - inv.dunningLastAt.getTime() < gapDays * 86_400_000) continue;

    // Find the customer behind the invoice (billing rows carry only a name).
    const customers = await prisma.sweepandgoCustomer.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, cellPhone: true, homePhone: true, email: true },
    });
    const match = customers.find((c) => customerNameKey(c) === inv.nameKey);
    if (!match) { skipped.push(`${inv.clientName}: no active customer record`); continue; }

    const phone = match.cellPhone || match.homePhone || "";
    const key = optOutKey(phone);
    if (key && optedOut.has(key)) { skipped.push(`${inv.clientName}: opted out`); continue; }

    const stage = inv.dunningStage + 1;
    const body = message(stage, firstNameOf(match.firstName || inv.clientName || ""), fmtMoney(inv.remainingCents), payLink || "");

    let sent = false;
    if (phone && isQuoConfigured()) {
      const r = await sendSms({ to: phone, body });
      sent = r.success;
    }
    if (!sent && match.email) {
      const r = await sendEmail({
        to: match.email,
        subject: `Payment issue on your DooGoodScoopers account`,
        html: wrapEmailHtml(`<p>${body}</p>`),
      });
      sent = r.success;
    }
    if (!sent) { skipped.push(`${inv.clientName}: no working phone or email`); continue; }

    await prisma.sngInvoice.update({
      where: { id: inv.id },
      data: { dunningStage: stage, dunningLastAt: new Date() },
    });
    // Keep it in the customer's message history like any other outreach.
    await prisma.leadMessage.create({
      data: {
        leadType: "CUSTOMER", leadId: match.id, direction: "OUTBOUND", body,
        phone: phone || "", provider: phone ? "quo" : "email", status: "SENT",
      },
    }).catch(() => {});
    messaged++;
  }

  await setSetting(LAST_RUN_KEY, `${new Date().toISOString()} atRisk=${atRisk.length} messaged=${messaged} recovered=${recoveredRows.length}`).catch(() => {});
  return { enabled, atRisk: atRisk.length, messaged, recovered: recoveredRows.length, skipped };
}
