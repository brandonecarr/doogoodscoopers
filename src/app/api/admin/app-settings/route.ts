import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Simple key/value settings for the /admin section (getSession auth).
// e.g. review-source links + the Google "leave a review" link for SMS.

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix");
  const rows = await prisma.appSetting.findMany({ where: prefix ? { key: { startsWith: prefix } } : undefined });
  const settings: Record<string, string> = {};
  // Never expose secrets (OAuth refresh tokens, secrets) to the browser.
  const isSecret = (k: string) => /secret|token/i.test(k);
  for (const r of rows) if (!isSecret(r.key)) settings[r.key] = r.value;
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settings } = await request.json();
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object required" }, { status: 400 });
  }
  const entries = Object.entries(settings) as [string, unknown][];
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: String(value ?? "") },
        update: { value: String(value ?? "") },
      })
    )
  );
  return NextResponse.json({ success: true });
}
