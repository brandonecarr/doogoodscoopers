import { NextRequest, NextResponse } from "next/server";
import { runDunning } from "@/lib/dunning";

// Failed-payment recovery. Detects outstanding balances, alerts the owner, and
// — only when dunning.enabled is on — nudges the customer to fix their card.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDunning();
  return NextResponse.json(result);
}
