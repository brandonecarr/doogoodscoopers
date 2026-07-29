/**
 * Brand colours for the email designer — a small saved palette the owner can
 * reuse across templates. Stored as one AppSetting row holding a JSON array of
 * hex strings.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const KEY = "email.brand.colors";
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const MAX = 24;

async function load(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string" && HEX.test(c)) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ colors: await load() });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const input = Array.isArray(body.colors) ? body.colors : [];
  // Normalise: valid hex only, lowercased, de-duped, capped.
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const c of input) {
    if (typeof c !== "string") continue;
    const v = c.trim().toLowerCase();
    if (!HEX.test(v) || seen.has(v)) continue;
    seen.add(v);
    colors.push(v);
    if (colors.length >= MAX) break;
  }

  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(colors) },
    update: { value: JSON.stringify(colors) },
  });

  return NextResponse.json({ colors });
}
