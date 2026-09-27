import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { businessDay } from "@/lib/tv-connector";

// Records today's active-customer count for the Apple TV board (pace and "you passed
// N on Tuesday"). Counts the Sweep&Go mirror that sync-customers keeps current.
// Runs hourly so the day's last value wins; safe to re-run.
// Auth: the Vercel cron Bearer token, OR a logged-in admin (to force a run).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) ||
    (await getSession());
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = businessDay();
  const value = await prisma.sweepandgoCustomer.count({ where: { active: true } });
  await prisma.tvMetricDaily.upsert({
    where: { date_metric: { date, metric: "active_customers" } },
    create: { date, metric: "active_customers", value },
    update: { value },
  });
  return NextResponse.json({ success: true, date, active_customers: value });
}
