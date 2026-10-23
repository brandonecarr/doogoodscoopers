import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateTv } from "@/lib/tv-connector";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";
const MAX_BYTES = 200_000;

type AnyBoard = { id?: unknown; hidden?: unknown } & Record<string, unknown>;
const boardsOf = (config: unknown): AnyBoard[] | null =>
  config && typeof config === "object" && Array.isArray((config as { boards?: unknown }).boards) ? ((config as { boards: AnyBoard[] }).boards) : null;

/** The config as the TV should see it: boards toggled off in the admin are left out, and the admin-only `hidden` flag is dropped. */
function forTv(config: unknown): unknown {
  const boards = boardsOf(config);
  if (!boards) return config;
  const shown = boards.filter((b) => b.hidden !== true).map((b) => { const copy = { ...b }; delete copy.hidden; return copy; });
  return { ...(config as object), boards: shown };
}

/**
 * A config saved by the TV only has the boards it was shown, so put the admin's hidden boards
 * back (at their old positions) before storing it; otherwise toggling a board off would delete it.
 */
function withHiddenBoards(incoming: object, stored: unknown): object {
  const storedBoards = boardsOf(stored);
  const incomingBoards = boardsOf(incoming);
  if (!storedBoards || !incomingBoards) return incoming;
  const hidden = storedBoards.map((b, i) => ({ b, i })).filter(({ b }) => b.hidden === true && !incomingBoards.some((x) => x.id === b.id));
  if (!hidden.length) return incoming;
  const merged = [...incomingBoards];
  for (const { b, i } of hidden) merged.splice(Math.min(i, merged.length), 0, b);
  return { ...incoming, boards: merged };
}

/** The TV's boards, hero goal and pipeline stages. `config` is null until a device saves one. */
export async function GET(request: Request) {
  if (!(await authenticateTv(request))) return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  const row = await prisma.tvConfig.findUnique({ where: { id: CONFIG_ID } });
  return NextResponse.json({ config: row ? forTv(row.config) : null, version: row?.version ?? 0, updatedAt: row?.updatedAt ?? null });
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
    return NextResponse.json({ error: "Config changed on another device", config: current ? forTv(current.config) : null, version: current?.version ?? 0 }, { status: 409 });
  }

  const config = withHiddenBoards(body.config as object, current?.config);
  const saved = current
    ? await prisma.tvConfig.update({ where: { id: CONFIG_ID }, data: { config, version: { increment: 1 } } })
    : await prisma.tvConfig.create({ data: { id: CONFIG_ID, config, version: 1 } });
  return NextResponse.json({ config: forTv(saved.config), version: saved.version, updatedAt: saved.updatedAt });
}
