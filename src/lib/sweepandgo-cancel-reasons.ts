import prisma from "@/lib/prisma";
import { recordSngCall } from "@/lib/sweepandgo-usage";
import { nameKey } from "@/lib/sweepandgo-billing";

// Cancellation reasons from Sweep&Go's subscriptions feed.
//
// Sweep&Go records WHY a subscription ended on the subscription itself:
//   termination_reason  — the category picked in the portal ("Too expensive", "Moved", "Other", …)
//   termination_comment — how it ended: "Canceled from employee portal", "Canceled by inactive
//                         client", or a plan change ("Changed price", "Changed clean up frequency",
//                         "Changed number of dogs - …", "Changed address")
//   termination_note    — the free-text note typed by staff
// Plan changes cancel the old subscription and start a new one, so they are NOT churn. Only the
// first two comments are real cancellations. Neither the active-clients feed nor the cancel
// webhook carries the note, which is why the growth dashboard showed "No data" / "Other".
//
// Walks /api/v2/subscriptions (50 per page; ~8 requests) and writes the reason + note onto the
// former-customer record and the CANCELLATION event. Runs daily after the customer sync.

const SNG_BASE = "https://openapi.sweepandgo.com/api/v2";
const PAGE_LENGTH = 50;
const MAX_PAGES = 30;
const CHURN_COMMENTS = new Set(["Canceled from employee portal", "Canceled by inactive client"]);
/** Event reasons that carry no information and may be replaced by what Sweep&Go has. */
const INACTIVE_LABEL = "Client went inactive (no reason recorded)";
const EMPTY_REASONS = new Set(["", "No data", "No reason provided", "Other", "null", INACTIVE_LABEL]);

export interface SngSubscription {
  status: string; canceled_at: string | null; client_name: string | null; client_email: string | null;
  termination_reason: string | null; termination_comment: string | null; termination_note: string | null;
  name: string | null; price: number | string | null;
}

export interface CancelReason { email: string; nameKey: string; clientName: string; canceledAt: Date; reason: string | null; note: string | null; comment: string }

function token(): string | undefined {
  return process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET || undefined;
}

export async function fetchAllSubscriptions(): Promise<SngSubscription[]> {
  const t = token();
  if (!t) throw new Error("SWEEPANDGO_API_TOKEN not set");
  const out: SngSubscription[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${SNG_BASE}/subscriptions?length=${PAGE_LENGTH}&page=${page}`;
    await recordSngCall(url);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`subscriptions page ${page}: HTTP ${res.status}`);
    const json = (await res.json()) as { subscriptions?: { data?: SngSubscription[]; last_page?: number } };
    const data = json.subscriptions?.data ?? [];
    out.push(...data);
    if (page >= (json.subscriptions?.last_page ?? page) || data.length === 0) break;
  }
  return out;
}

/**
 * One reason per client, keyed by email: the latest real cancellation (plan changes ignored).
 * When the latest record says nothing (typically "Canceled by inactive client" after the
 * account was closed), the most recent informative cancellation within 120 days wins
 * instead — the note staff typed is the point of all this.
 */
export function cancelReasonsFrom(subs: SngSubscription[]): CancelReason[] {
  const byClient = new Map<string, CancelReason[]>();
  for (const s of subs) {
    if (s.status !== "canceled" || !s.canceled_at || !CHURN_COMMENTS.has(s.termination_comment || "")) continue;
    const email = (s.client_email || "").trim().toLowerCase();
    const key = email || nameKey(s.client_name);
    if (!key) continue;
    const r: CancelReason = {
      email, nameKey: nameKey(s.client_name), clientName: (s.client_name || "").trim(),
      canceledAt: new Date(`${s.canceled_at.slice(0, 10)}T12:00:00Z`),
      reason: (s.termination_reason || "").trim() || null, note: (s.termination_note || "").trim() || null,
      comment: s.termination_comment || "",
    };
    (byClient.get(key) ?? byClient.set(key, []).get(key)!).push(r);
  }
  const informative = (r: CancelReason) => !!(r.reason || r.note);
  const out: CancelReason[] = [];
  for (const list of byClient.values()) {
    list.sort((a, b) => b.canceledAt.getTime() - a.canceledAt.getTime() || Number(informative(b)) - Number(informative(a)));
    const latest = list[0];
    const better = informative(latest) ? null : list.find((r) => informative(r) && latest.canceledAt.getTime() - r.canceledAt.getTime() <= 120 * 86_400_000);
    out.push(better ? { ...better, canceledAt: latest.canceledAt } : latest);
  }
  return out;
}

/** Write reasons onto former customers and cancellation events. Returns counts. */
export async function applyCancellationReasons(reasons: CancelReason[]): Promise<{ customers: number; events: number }> {
  let customers = 0, events = 0;
  const DAY = 86_400_000;
  const allEvents = await prisma.subscriptionEvent.findMany({ where: { kind: "CANCELLATION" }, select: { id: true, email: true, clientName: true, occurredAt: true, reason: true, reasonDetail: true } });
  for (const r of reasons) {
    const label = r.reason ?? (r.comment === "Canceled by inactive client" ? INACTIVE_LABEL : null);
    if (r.email) {
      const u = await prisma.sweepandgoCustomer.updateMany({
        where: { email: { equals: r.email, mode: "insensitive" }, active: false },
        data: { cancelReason: label, cancelNote: r.note, canceledAt: r.canceledAt },
      });
      customers += u.count;
    }
    // Match the event by email (sync-logged) or by name (spreadsheet-imported), within ±60 days.
    const matches = allEvents.filter((e) => {
      const byEmail = r.email && e.email && e.email.trim().toLowerCase() === r.email;
      const byName = !e.email && e.clientName && nameKey(e.clientName) === r.nameKey && r.nameKey;
      return (byEmail || byName) && Math.abs(e.occurredAt.getTime() - r.canceledAt.getTime()) <= 60 * DAY;
    });
    for (const e of matches) {
      const replaceReason = label && (!e.reason || EMPTY_REASONS.has(e.reason));
      const data: { reason?: string; reasonDetail?: string | null } = {};
      if (replaceReason) data.reason = label;
      if (r.note && r.note !== e.reasonDetail) data.reasonDetail = r.note;
      if (Object.keys(data).length) { await prisma.subscriptionEvent.update({ where: { id: e.id }, data }); events++; }
    }
  }
  return { customers, events };
}

export async function syncCancellationReasons(): Promise<{ ok: boolean; subscriptions: number; reasons: number; customers: number; events: number; error?: string }> {
  try {
    const subs = await fetchAllSubscriptions();
    const reasons = cancelReasonsFrom(subs);
    const applied = await applyCancellationReasons(reasons);
    return { ok: true, subscriptions: subs.length, reasons: reasons.length, ...applied };
  } catch (e) {
    return { ok: false, subscriptions: 0, reasons: 0, customers: 0, events: 0, error: e instanceof Error ? e.message : "failed" };
  }
}
