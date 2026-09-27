import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateTv } from "@/lib/tv-connector";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";
const MAX_BYTES = 200_000;

/** The TV's boards, hero goal and pipeline stages. `config` is null until a device saves one. */
export async function GET(request: Request) {
  if (!(await authenticateTv(request))) return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  const row = await prisma.tvConfig.findUnique({ where: { id: CONFIG_ID } });
  return NextResponse.json({ config: row?.config ?? null, version: row?.version ?? 0, updatedAt: row?.updatedAt ?? null });
}

/**
 * Saves the config. Send the `version` you last read; if someone else saved since,
 * this returns 409 with the current config so the device can merge and retry.
 */
export async function PUT(request: Request) {
  if (!(await authenticateTv(request))) return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "Config too large" }, { status: 413 });

  let body: { config?: unknown; version?: unknown };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
    return NextResponse.json({ error: "config must be an object" }, { status: 400 });
  }
  const expected = Number(body.version ?? 0);

  const current = await prisma.tvConfig.findUnique({ where: { id: CONFIG_ID } });
  if ((current?.version ?? 0) !== expected) {
    return NextResponse.json({ error: "Config changed on another device", config: current?.config ?? null, version: current?.version ?? 0 }, { status: 409 });
  }

  const config = body.config as object;
  const saved = current
    ? await prisma.tvConfig.update({ where: { id: CONFIG_ID }, data: { config, version: { increment: 1 } } })
    : await prisma.tvConfig.create({ data: { id: CONFIG_ID, config, version: 1 } });
  return NextResponse.json({ config: saved.config, version: saved.version, updatedAt: saved.updatedAt });
}
