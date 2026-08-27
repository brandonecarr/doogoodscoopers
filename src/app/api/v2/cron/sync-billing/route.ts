import { NextRequest, NextResponse } from "next/server";
import { syncSngBilling } from "@/lib/sweepandgo-billing";
import { setSetting } from "@/lib/google-business";

// Refreshes the Sweep&Go billing mirror (invoices + payments) that powers the
// lifetime-value header and invoice list on each customer profile.
export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const result = await syncSngBilling();
  await setSetting(
    "billing.lastSync",
    `${new Date().toISOString()} ok=${result.ok} complete=${result.complete} rows=${result.rows}` +
      `${result.resumeAt ? ` resumeAt=${result.resumeAt}` : ""}` +
      `${result.unknownStatuses?.length ? ` unknownStatuses=${result.unknownStatuses.join(",")}` : ""}` +
      `${result.error ? ` error=${result.error}` : ""}`
  ).catch(() => {});

  return NextResponse.json({ ...result, ms: Date.now() - started });
}
