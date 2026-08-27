import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getSetting, setSetting } from "@/lib/google-business";
import { brevoSend, isBrevoConfigured, parseAddr } from "@/lib/brevo-email";

// ── Proactive anomaly watch ──────────────────────────────────────────────────
// Runs daily. Checks a handful of business vital signs against a baseline and,
// only when something looks off, pings the owner: an in-app notification (the
// header bell) + a phone push, and a single digest email when the set of issues
// changes. "Works while you sleep" — the numbers are ready before the owner asks.
// Detection is deterministic (no AI dependency) so the cron is reliable.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.vercel.app";
const ALERT_EMAIL = process.env.ALERT_EMAIL || process.env.OWNER_EMAIL || "brandonecarr@gmail.com";
const FROM = "DooGoodScoopers <service@doogoodscoopers.com>";

export interface Anomaly {
  key: string; // stable per condition — drives notification dedupe
  severity: "warning" | "error";
  title: string;
  body: string;
  link: string;
}

const DAY = 86_400_000;

/** Count new leads across all three pipelines in a [start, end) window. */
async function leadsBetween(start: Date, end: Date): Promise<number> {
  const where = { createdAt: { gte: start, lt: end } };
  const [a, b, c] = await Promise.all([
    prisma.quoteLead.count({ where }),
    prisma.adLead.count({ where }),
    prisma.canvasserLead.count({ where }),
  ]);
  return a + b + c;
}

async function cancelsBetween(start: Date, end: Date): Promise<number> {
  return prisma.subscriptionEvent.count({ where: { excluded: false, kind: "CANCELLATION", occurredAt: { gte: start, lt: end } } });
}

/** Run every check and return whatever is currently off. */
export async function detectAnomalies(now = new Date()): Promise<Anomaly[]> {
  const ago = (n: number) => new Date(now.getTime() - n * DAY);
  const out: Anomaly[] = [];

  // ── Lead flow ───────────────────────────────────────────────────────────
  const [last7Leads, prev7Leads, leads56] = await Promise.all([
    leadsBetween(ago(7), now),
    leadsBetween(ago(14), ago(7)),
    leadsBetween(ago(56), now),
  ]);
  const weeklyLeadAvg = leads56 / 8;

  if (last7Leads === 0 && weeklyLeadAvg >= 2) {
    out.push({
      key: "leads-none",
      severity: "error",
      title: "No new leads in 7 days",
      body: `Zero new leads in the last week — you normally see about ${Math.round(weeklyLeadAvg)}/week. Worth checking ads, forms, and the funnel.`,
      link: "/admin/leads",
    });
  } else if (prev7Leads >= 5 && last7Leads <= prev7Leads * 0.5) {
    const pct = Math.round((1 - last7Leads / prev7Leads) * 100);
    out.push({
      key: "leads-drop",
      severity: "warning",
      title: `New leads down ${pct}% this week`,
      body: `${last7Leads} new leads in the last 7 days vs ${prev7Leads} the week before.`,
      link: "/admin/leads",
    });
  }

  // ── Churn / growth ──────────────────────────────────────────────────────
  const [cancels7, cancels56, signups7] = await Promise.all([
    cancelsBetween(ago(7), now),
    cancelsBetween(ago(56), now),
    prisma.subscriptionEvent.count({ where: { excluded: false, kind: "SIGNUP", occurredAt: { gte: ago(7), lt: now } } }),
  ]);
  const weeklyCancelAvg = cancels56 / 8;

  if (cancels7 >= 4 && cancels7 >= 2 * weeklyCancelAvg) {
    out.push({
      key: "churn-spike",
      severity: cancels7 >= 8 || cancels7 >= 3 * weeklyCancelAvg ? "error" : "warning",
      title: `Churn spike: ${cancels7} cancellations this week`,
      body: `${cancels7} cancellations in the last 7 days${weeklyCancelAvg >= 0.5 ? ` vs a ~${weeklyCancelAvg.toFixed(1)}/week average` : ""}. Check the reasons and reach out.`,
      link: "/admin/customers?view=dashboard",
    });
  }

  if (signups7 - cancels7 < 0 && cancels7 >= 2) {
    out.push({
      key: "net-negative",
      severity: "warning",
      title: "Net customer growth is negative this week",
      body: `${signups7} new signup${signups7 === 1 ? "" : "s"} vs ${cancels7} cancellations — a net of ${signups7 - cancels7} over the last 7 days.`,
      link: "/admin/customers?view=dashboard",
    });
  }

  // ── Failed message sends (last 24h) ─────────────────────────────────────
  const failedSends = await prisma.campaignRecipient.count({
    where: {
      status: "FAILED",
      OR: [{ sentAt: { gte: ago(1) } }, { AND: [{ sentAt: null }, { createdAt: { gte: ago(1) } }] }],
    },
  });
  if (failedSends > 0) {
    out.push({
      key: "sends-failed",
      severity: "error",
      title: `${failedSends} message${failedSends === 1 ? "" : "s"} failed to send in 24h`,
      body: `${failedSends} text${failedSends === 1 ? "" : "s"} couldn't be delivered. A lead or customer may not have heard back.`,
      link: "/admin/campaigns",
    });
  }

  // ── New low-star reviews (one alert per review) ─────────────────────────
  const negReviews = await prisma.review.findMany({
    where: { status: "COMPLETED", rating: { lte: 3 }, createdAt: { gte: ago(14) } },
    select: { id: true, rating: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const r of negReviews) {
    out.push({
      key: `neg-review:${r.id}`,
      severity: "error",
      title: `New ${r.rating}★ review — respond fast`,
      body: "A recent review came in at 3 stars or below. A quick, kind reply protects your rating.",
      link: "/admin/reviews",
    });
  }

  // ── Stale, un-worked leads ──────────────────────────────────────────────
  const staleWhere = { status: "NEW" as const, archived: false, createdAt: { lt: ago(3), gte: ago(30) } };
  const [sa, sb, sc] = await Promise.all([
    prisma.quoteLead.count({ where: staleWhere }),
    prisma.adLead.count({ where: staleWhere }),
    prisma.canvasserLead.count({ where: staleWhere }),
  ]);
  const stale = sa + sb + sc;
  if (stale >= 3) {
    out.push({
      key: "stale-leads",
      severity: "warning",
      title: `${stale} new leads waiting 3+ days`,
      body: `${stale} leads are still marked "New" with no follow-up. The faster you reach out, the more you close.`,
      link: "/admin/leads",
    });
  }

  return out;
}

function digestHtml(anomalies: Anomaly[]): string {
  const rows = anomalies
    .map(
      (a) => `
      <tr><td style="padding:14px 16px;border:1px solid #EAECF0;border-radius:12px;display:block;margin-bottom:10px;background:${a.severity === "error" ? "#FEF3F2" : "#FFFAEB"}">
        <div style="font-size:15px;font-weight:700;color:#101828">${a.severity === "error" ? "🔴" : "🟡"} ${a.title}</div>
        <div style="font-size:13.5px;color:#475467;margin-top:4px;line-height:1.5">${a.body}</div>
        <a href="${APP_URL}${a.link}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#6D3EF0;text-decoration:none">Take a look →</a>
      </td></tr>`
    )
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px">
    <div style="font-size:18px;font-weight:800;color:#101828;margin:8px 0 4px">Morning check — ${anomalies.length} thing${anomalies.length === 1 ? "" : "s"} to look at</div>
    <div style="font-size:13.5px;color:#667085;margin-bottom:16px">Your overnight watch on DooGoodScoopers. Everything else looks normal.</div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <div style="font-size:11.5px;color:#98A2B3;margin-top:16px">You're getting this because a business metric moved outside its normal range. It won't email you again until the situation changes.</div>
  </div>`;
}

/** Detect, notify in-app (+push), and email a digest when the situation changes. */
export async function runAnomalyWatch(now = new Date()): Promise<{ count: number; keys: string[]; emailed: boolean }> {
  const anomalies = await detectAnomalies(now);

  for (const a of anomalies) {
    await notify({
      type: "system",
      severity: a.severity,
      title: a.title,
      body: a.body,
      link: a.link,
      dedupeKey: `anomaly:${a.key}`,
      push: true,
    });
  }

  // Email a single digest, but only when the set of issues changes — so a
  // persistent condition doesn't email every morning.
  let emailed = false;
  const sig = anomalies.map((a) => a.key).sort().join("|");
  const lastSig = (await getSetting("anomaly_email_sig")) || "";

  if (anomalies.length && sig !== lastSig) {
    if (isBrevoConfigured()) {
      const res = await brevoSend({
        from: parseAddr(FROM),
        to: [parseAddr(ALERT_EMAIL)],
        subject: `⚠️ DooGoodScoopers: ${anomalies.length} thing${anomalies.length === 1 ? "" : "s"} need a look`,
        html: digestHtml(anomalies),
        tags: ["anomaly-watch"],
      });
      emailed = !res.error;
      if (res.error) console.error("[anomaly-watch] email failed:", res.error);
    }
    await setSetting("anomaly_email_sig", sig);
  } else if (!anomalies.length && lastSig) {
    // All clear — reset so the next occurrence emails again.
    await setSetting("anomaly_email_sig", "");
  }

  return { count: anomalies.length, keys: anomalies.map((a) => a.key), emailed };
}
