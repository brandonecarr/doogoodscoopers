import { NextRequest, NextResponse } from "next/server";
import { billingRefreshDue, syncSngBilling, recordBillingSyncResult } from "@/lib/sweepandgo-billing";

// Every 15 minutes: refresh the billing mirror ONLY if a Sweep&Go billing webhook
// (invoice finalized / payment accepted / payment declined) arrived since the last run,
// has settled for 2 minutes, and the last run was over an hour ago. It reads only the
// newest invoices (refresh-only: 4 requests) and never advances a full walk; otherwise it
// returns without calling Sweep&Go at all. The daily /api/v2/cron/sync-billing reconciles.
export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const check = await billingRefreshDue();
  if (!check.due) return NextResponse.json({ skipped: true, reason: check.reason });

  const started = Date.now();
  const result = await syncSngBilling({ refreshOnly: true });
  await recordBillingSyncResult(result);
  return NextResponse.json({ reason: check.reason, ...result, ms: Date.now() - started });
}
