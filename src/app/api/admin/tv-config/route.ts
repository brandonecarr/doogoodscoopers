import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { defaultConfig, validateConfig, type TvBoardConfig } from "@/lib/tv-config";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";

/** Current active customers and the average weekly net change over 8 weeks, for the goal editor's pace hint. */
async function goalContext() {
  const since = new Date(Date.now() - 56 * 86_400_000);
  const [active, events] = await Promise.all([
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    prisma.subscriptionEvent.findMany({
      where: { occurredAt: { gte: since }, kind: { in: ["SIGNUP", "CANCELLATION"] }, excluded: false },
      select: { kind: true },
    }),
  ]);
  const net = events.reduce((n, e) => n + (e.kind === "SIGNUP" ? 1 : -1), 0);
  return { activeCustomers: active, weeklyPace: Math.round((net / 8) * 10) / 10 };
}

/** The board config the TVs use (or the design default if none has been saved yet). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [row, context] = await Promise.all([prisma.tvConfig.findUnique({ where: { id: CONFIG_ID } }), goalContext()]);
  return NextResponse.json({
    config: (row?.config as unknown as TvBoardConfig) ?? defaultConfig(),
    version: row?.version ?? 0,
    isDefault: !row,
    updatedAt: row?.updatedAt ?? null,
    context,
  });
}

/** Saves after checking the TV can draw it. Send the `version` you loaded; 409 if a TV saved since. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const config = body?.config as TvBoardConfig | undefined;
  if (!config || typeof config !== "object") return NextResponse.json({ error: "config is required" }, { status: 400 });

  const errors = validateConfig(config);
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 422 });

  const current = await prisma.tvConfig.findUnique({ where: { id: CONFIG_ID } });
  if ((current?.version ?? 0) !== Number(body.version ?? 0)) {
    return NextResponse.json({ error: "The TV changed these settings since you opened this page. Reload to see its changes.", version: current?.version ?? 0 }, { status: 409 });
  }
  const json = config as unknown as object;
  const saved = current
    ? await prisma.tvConfig.update({ where: { id: CONFIG_ID }, data: { config: json, version: { increment: 1 } } })
    : await prisma.tvConfig.create({ data: { id: CONFIG_ID, config: json, version: 1 } });
  return NextResponse.json({ config: saved.config, version: saved.version, updatedAt: saved.updatedAt });
}
