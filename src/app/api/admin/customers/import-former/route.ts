import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// One-time (re-runnable) backfill of DISABLED / inactive Sweep&Go residential
// customers into the "Former customers" archive. Like the active-customer sync
// this only ever GETs from Sweep&Go and never writes back. Upserts by sngId with
// active=false, preserving any dates already recorded for a customer we've seen.
//
// Sweep&Go has no "disabled-on" date in this feed, so removedAt stays null for
// brand-new rows (shown as "—" in the archive) rather than faking today's date.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SNG_BASE = "https://openapi.sweepandgo.com/api/v1";
// Primary path first; fall back if the account exposes a different name.
const INACTIVE_PATHS = ["clients/inactive", "clients/disabled"];
const MAX_PAGES = 50;

interface SngClient {
  client: string;
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

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.SWEEPANDGO_API_TOKEN || process.env.SWEEPANDGO_WEBHOOK_SECRET;
  if (!token) {
    return NextResponse.json({ error: "Missing SWEEPANDGO_API_TOKEN" }, { status: 500 });
  }

  const fetchPage = (path: string, p: number) =>
    fetch(`${SNG_BASE}/${path}?page=${p}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

  // Find the working path by trying page 1 of each candidate.
  let activePath: string | null = null;
  let firstJson: { data?: SngClient[]; paginate?: { total_pages?: number } } | null = null;
  for (const path of INACTIVE_PATHS) {
    try {
      const res = await fetchPage(path, 1);
      if (res.ok) {
        activePath = path;
        firstJson = await res.json();
        break;
      }
    } catch {
      /* try next candidate */
    }
  }
  if (!activePath || !firstJson) {
    return NextResponse.json({ error: "Could not reach Sweep&Go's inactive-clients feed." }, { status: 502 });
  }

  const clients: SngClient[] = [...((firstJson.data ?? []) as SngClient[])];
  const totalPages = firstJson.paginate?.total_pages ?? 1;
  try {
    for (let page = 2; page <= totalPages && page <= MAX_PAGES; page++) {
      const res = await fetchPage(activePath, page);
      if (!res.ok) break;
      const json = await res.json();
      clients.push(...((json.data ?? []) as SngClient[]));
    }
  } catch (err) {
    console.error("[SNG former] paging failed:", err);
    // Keep what we pulled; report below.
  }

  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const c of clients) {
    if (!c.client) continue;
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
      lastSyncedAt: now,
    };
    const result = await prisma.sweepandgoCustomer.upsert({
      where: { sngId: c.client },
      // New disabled customer → former, with unknown dates (startDate/removedAt null).
      create: { sngId: c.client, firstSeenAt: now, active: false, ...fields },
      // Existing row → refresh fields + ensure it's marked former; don't disturb
      // firstSeenAt / startDate / removedAt already on file.
      update: { ...fields, active: false },
    });
    if (result.firstSeenAt.getTime() === now.getTime()) created++;
    else updated++;
  }

  return NextResponse.json({ success: true, pulled: clients.length, created, updated });
}
