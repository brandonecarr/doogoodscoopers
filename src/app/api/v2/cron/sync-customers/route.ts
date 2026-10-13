import { NextRequest, NextResponse } from "next/server";
import { syncActiveCustomers } from "@/lib/sweepandgo-customer-sync";
import { syncCancellationReasons } from "@/lib/sweepandgo-cancel-reasons";

// Daily reconciliation of the Sweep&Go customer mirror (6 AM Pacific, vercel.json).
// Changes normally land within ~30s via Sweep&Go client webhooks (see
// lib/sweepandgo-customer-sync.ts); this catches anything a webhook missed.
// Cron protection: standard CRON_SECRET check.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncActiveCustomers();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  // Why people cancelled, from the subscriptions feed (~8 requests). Never blocks the sync.
  const reasons = await syncCancellationReasons();
  return NextResponse.json({ success: true, ...result, cancellationReasons: reasons });
}
