import prisma from "@/lib/prisma";
import { archiveConvertedLeads } from "@/lib/lead-duplicates";
import { estimateMonthlyRevenue } from "@/lib/plan-pricing";
import { recordSngCall } from "@/lib/sweepandgo-usage";

// One-way mirror of ACTIVE Sweep&Go residential customers (SweepandgoCustomer).
//
// Only ever GETs from Sweep&Go and NEVER writes back. Each run:
//   1. Pulls every page of /api/v1/clients/active (50 per page: 63 clients = 2 requests).
//   2. Upserts each customer (also re-activates one that had been archived); a new one
//      logs a SIGNUP on the growth dashboard and archives their prospect lead(s).
//   3. Archives any local customer that fell off the active list and logs a CANCELLATION.
//
// Runs two ways: the daily sync-customers cron (reconciliation), and right after a
// Sweep&Go client webhook (signup / subscription / status change) via
// syncCustomersForEvent(), so changes land within ~30 seconds. Sweep&Go webhooks are
// unauthenticated, so a webhook is only a TRIGGER; the data always comes from the API.

const SNG_ACTIVE_CLIENTS_URL = "https://openapi.sweepandgo.com/api/v1/clients/active";
const PAGE_LENGTH = 50; // the API's max page size (default 15)
const MAX_PAGES = 50; // safety bound

export const LAST_START_KEY = "sng.customerSync.lastStartedAt";
export const LAST_SUCCESS_KEY = "sng.customerSync.lastSuccessAt";

interface SngClient {
  client: string; // rcl_...
  type: string | null;
  status: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  zip_code: string | null;
  home_phone: string | null;
  cell_phone: string | null;
  subscription_names: string | null;
  one_time_client: boolean | null;
  channel: string | null;
  service_days: string | null;
  assigned_to: string | null;
  cleanup_frequency: string | null;
}

export type CustomerSyncResult =
  | { ok: true; pulled: number; created: number; updated: number; archived: number; leadsArchived: number; note?: string }
  | { ok: false; error: string };

async function stamp(key: string, at: Date): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: at.toISOString() }, update: { value: at.toISOString() } });
}

/** Pull the active list from Sweep&Go and reconcile the local mirror. */
export async function syncActiveCustomers(): Promise<CustomerSyncResult> {
  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) return { ok: false, error: "Missing SWEEPANDGO_API_TOKEN (or SWEEPANDGO_WEBHOOK_SECRET)" };
  await stamp(LAST_START_KEY, new Date());

  // ── Pull ALL pages of active residential clients ────────────────────────────
  const clients: SngClient[] = [];
  let page = 1;
  let totalPages = 1;
  try {
    do {
      await recordSngCall(SNG_ACTIVE_CLIENTS_URL);
      const res = await fetch(`${SNG_ACTIVE_CLIENTS_URL}?page=${page}&length=${PAGE_LENGTH}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[SNG customers] API ${res.status} on page ${page}: ${detail.slice(0, 200)}`);
        return { ok: false, error: `Sweep&Go API returned ${res.status}${res.status === 401 ? " (token invalid for /clients/active)" : ""}` };
      }
      const json = await res.json();
      const data: SngClient[] = json.data ?? [];
      clients.push(...data);
      totalPages = json.paginate?.total_pages ?? page;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);
  } catch (err) {
    console.error("[SNG customers] fetch failed:", err);
    return { ok: false, error: "Sweep&Go fetch failed" };
  }

  // ── Safety: never treat an empty/failed pull as "everyone cancelled" ─────────
  if (clients.length === 0) {
    return { ok: true, pulled: 0, created: 0, updated: 0, archived: 0, leadsArchived: 0, note: "empty pull — skipped reconciliation" };
  }

  const now = new Date();
  const seenIds: string[] = [];
  // Former customers who reappear on the active list came back (e.g. a win-back).
  const wasInactive = new Set(
    (await prisma.sweepandgoCustomer.findMany({ where: { active: false }, select: { sngId: true } })).map((r) => r.sngId),
  );
  let created = 0;
  let updated = 0;
  let leadsArchived = 0;

  for (const c of clients) {
    if (!c.client) continue;
    seenIds.push(c.client);
    // Sweep&Go encodes the dog count in the plan name ("2d-1xW" = 2 dogs, once
    // a week). It's the only dog data their API exposes — no names or breeds.
    const dogMatch = (c.subscription_names || "").match(/(\d+)\s*d-/i);
    const fields = {
      type: c.type ?? null,
      sngStatus: c.status ?? null,
      firstName: c.first_name ?? null,
      lastName: c.last_name ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
      zipCode: c.zip_code ?? null,
      homePhone: c.home_phone ?? null,
      cellPhone: c.cell_phone ?? null,
      subscriptionNames: c.subscription_names ?? null,
      numberOfDogs: dogMatch ? parseInt(dogMatch[1], 10) : null,
      oneTimeClient: !!c.one_time_client,
      channel: c.channel ?? null,
      serviceDays: c.service_days ?? null,
      assignedTo: c.assigned_to ?? null,
      cleanupFrequency: c.cleanup_frequency ?? null,
      active: true,
      removedAt: null,
      lastSyncedAt: now,
    };
    const result = await prisma.sweepandgoCustomer.upsert({
      where: { sngId: c.client },
      // Sweep&Go's feed has no created-at, so a brand-new customer's startDate is
      // set to first-seen (they're synced within the hour of signing up). Never
      // overwritten on later syncs, preserving backfilled dates.
      create: { sngId: c.client, firstSeenAt: now, startDate: now, ...fields },
      update: fields,
    });
    // upsert doesn't report create-vs-update; approximate via firstSeenAt.
    if (result.firstSeenAt.getTime() === now.getTime()) {
      created++;
      // Record the signup on the Customers → Dashboard growth chart (idempotent).
      await prisma.subscriptionEvent.upsert({
        where: { dedupeKey: `sng-signup:${result.sngId}` },
        create: {
          kind: "SIGNUP", occurredAt: result.startDate ?? now,
          clientName: [result.firstName, result.lastName].filter(Boolean).join(" ") || null,
          email: result.email, zipCode: result.zipCode, plan: result.subscriptionNames,
          revenue: estimateMonthlyRevenue(result.subscriptionNames),
          source: "sync-customers", dedupeKey: `sng-signup:${result.sngId}`,
        },
        update: {},
      }).catch((e) => console.error("[sync-customers] signup event failed:", e));
      // A brand-new customer means this person converted — archive their old
      // prospect lead(s) so they stop showing/behaving as an active lead.
      try {
        leadsArchived += await archiveConvertedLeads([c.cell_phone, c.home_phone]);
      } catch (e) {
        console.error("[sync-customers] lead archive failed:", e);
      }
    } else {
      updated++;
      if (wasInactive.has(result.sngId)) {
        // A returning customer re-activates their own record, so the create path above
        // never logs it. Record the return as a SIGNUP (keeps the growth dashboard's net
        // in step with the active count) and archive any prospect lead they left.
        await prisma.subscriptionEvent.upsert({
          where: { dedupeKey: `sng-return:${result.sngId}:${now.toISOString().slice(0, 10)}` },
          create: {
            kind: "SIGNUP", occurredAt: now,
            clientName: [result.firstName, result.lastName].filter(Boolean).join(" ") || null,
            email: result.email, zipCode: result.zipCode, plan: result.subscriptionNames,
            revenue: estimateMonthlyRevenue(result.subscriptionNames), reason: "returning customer",
            source: "sync-customers", dedupeKey: `sng-return:${result.sngId}:${now.toISOString().slice(0, 10)}`,
          },
          update: {},
        }).catch((e) => console.error("[sync-customers] return event failed:", e));
        try { leadsArchived += await archiveConvertedLeads([c.cell_phone, c.home_phone]); } catch (e) { console.error("[sync-customers] lead archive failed:", e); }
      }
    }
  }

  // ── Archive customers that fell off the active list ─────────────────────────
  const leavingWhere = { active: true, sngId: { notIn: seenIds } };
  const leaving = await prisma.sweepandgoCustomer.findMany({
    where: leavingWhere,
    select: { sngId: true, firstName: true, lastName: true, email: true, zipCode: true, subscriptionNames: true },
  });
  const archived = await prisma.sweepandgoCustomer.updateMany({
    where: leavingWhere,
    data: { active: false, removedAt: now },
  });
  // Record each cancellation on the growth dashboard (idempotent).
  for (const c of leaving) {
    await prisma.subscriptionEvent.upsert({
      where: { dedupeKey: `sng-cancel:${c.sngId}` },
      create: {
        kind: "CANCELLATION", occurredAt: now,
        clientName: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
        email: c.email, zipCode: c.zipCode, plan: c.subscriptionNames,
        revenue: estimateMonthlyRevenue(c.subscriptionNames),
        source: "sync-customers", dedupeKey: `sng-cancel:${c.sngId}`,
      },
      update: {},
    }).catch((e) => console.error("[sync-customers] cancel event failed:", e));
  }

  await stamp(LAST_SUCCESS_KEY, new Date());
  return { ok: true, pulled: clients.length, created, updated, archived: archived.count, leadsArchived };
}

// ── Webhook-triggered sync ──────────────────────────────────────────────────────
// A signup fires several client events within a second or two (onboarding, subscription
// created, status change), each delivered 2-3 times. Claim a sync that starts SETTLE_MS
// from now; any event created before that start is covered by it and skips.
const SETTLE_MS = 20_000;

/** Run one customer sync for a Sweep&Go client event unless one already covers it. */
export async function syncCustomersForEvent(eventAt: Date): Promise<"ran" | "covered" | CustomerSyncResult> {
  const startAt = new Date(Date.now() + SETTLE_MS);
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AppSetting" ("key", "value", "updatedAt", "createdAt")
      VALUES (${LAST_START_KEY}, '1970-01-01T00:00:00.000Z', now(), now())
      ON CONFLICT ("key") DO NOTHING`;
    const [row] = await tx.$queryRaw<{ value: string }[]>`SELECT "value" FROM "AppSetting" WHERE "key" = ${LAST_START_KEY} FOR UPDATE`;
    if (Date.parse(row.value) >= eventAt.getTime()) return false;
    await tx.appSetting.update({ where: { key: LAST_START_KEY }, data: { value: startAt.toISOString() } });
    return true;
  });
  if (!claimed) return "covered";
  await new Promise((r) => setTimeout(r, Math.max(0, startAt.getTime() - Date.now())));
  const result = await syncActiveCustomers();
  if (!result.ok) console.error("[customer-sync] webhook-triggered sync failed:", result.error);
  return result.ok ? "ran" : result;
}

/** When the mirror last completed a full sync (null if never). */
export async function lastCustomerSyncAt(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: LAST_SUCCESS_KEY } });
  const t = row ? Date.parse(row.value) : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
}
