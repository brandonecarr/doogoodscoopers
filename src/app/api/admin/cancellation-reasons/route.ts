import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncCancellationReasons } from "@/lib/sweepandgo-cancel-reasons";

// POST → pull cancellation reasons/notes from Sweep&Go's subscriptions feed now (~8 API requests).
// The daily customer sync does the same every morning.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await syncCancellationReasons();
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
