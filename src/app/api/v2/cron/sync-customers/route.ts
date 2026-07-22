import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// One-way mirror of ACTIVE Sweep&Go residential customers.
//
// This cron only ever GETs from Sweep&Go and NEVER writes back — so nothing in
// this project can affect the Sweep&Go customer list. Each hourly run:
//   1. Pulls every page of /api/v1/clients/active.
//   2. Upserts each customer (also re-activates one that had been archived).
//   3. Archives (active=false, removedAt=now) any local customer that fell off
//      the active list — they move to the "Former customers" archive, not deleted.
//
// Auth to Sweep&Go: same Bearer token as the free-quotes sync.
// Cron protection: standard CRON_SECRET check.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SNG_ACTIVE_CLIENTS_URL = "https://openapi.sweepandgo.com/api/v1/clients/active";
const MAX_PAGES = 50; // safety bound

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

export async function GET(request: NextRequest) {
  // ── Cron auth ───────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) {
    return NextResponse.json({ error: "Missing SWEEPANDGO_API_TOKEN (or SWEEPANDGO_WEBHOOK_SECRET)" }, { status: 500 });
  }

  // ── Pull ALL pages of active residential clients ────────────────────────────
  const clients: SngClient[] = [];
  let page = 1;
  let totalPages = 1;
  try {
    do {
      const res = await fetch(`${SNG_ACTIVE_CLIENTS_URL}?page=${page}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[SNG customers] API ${res.status} on page ${page}: ${detail.slice(0, 200)}`);
        return NextResponse.json(
          { error: `Sweep&Go API returned ${res.status}`, hint: res.status === 401 ? "Token invalid for /clients/active" : undefined },
          { status: 502 }
        );
      }
      const json = await res.json();
      const data: SngClient[] = json.data ?? [];
      clients.push(...data);
      totalPages = json.paginate?.total_pages ?? page;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);
  } catch (err) {
    console.error("[SNG customers] fetch failed:", err);
    return NextResponse.json({ error: "Sweep&Go fetch failed" }, { status: 502 });
  }

  // ── Safety: never treat an empty/failed pull as "everyone cancelled" ─────────
  if (clients.length === 0) {
    return NextResponse.json({ success: true, pulled: 0, note: "empty pull — skipped reconciliation" });
  }

  const now = new Date();
  const seenIds: string[] = [];
  let created = 0;
  let updated = 0;

  for (const c of clients) {
    if (!c.client) continue;
    seenIds.push(c.client);
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
      create: { sngId: c.client, firstSeenAt: now, ...fields },
      update: fields,
    });
    // upsert doesn't report create-vs-update; approximate via firstSeenAt.
    if (result.firstSeenAt.getTime() === now.getTime()) created++;
    else updated++;
  }

  // ── Archive customers that fell off the active list ─────────────────────────
  const archived = await prisma.sweepandgoCustomer.updateMany({
    where: { active: true, sngId: { notIn: seenIds } },
    data: { active: false, removedAt: now },
  });

  return NextResponse.json({
    success: true,
    pulled: clients.length,
    created,
    updated,
    archived: archived.count,
  });
}
