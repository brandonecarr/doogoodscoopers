import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EXPENSE_CATEGORIES } from "@/lib/profitability";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(EXPENSE_CATEGORIES.map((c) => c.key));

/** Dollars (string or number) → integer cents. */
function toCents(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = await prisma.expense.findMany({
    orderBy: [{ kind: "asc" }, { amountCents: "desc" }],
  });
  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  const label = String(b.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Give the expense a name" }, { status: 400 });

  const amountCents = toCents(b.amount);
  if (amountCents <= 0) return NextResponse.json({ error: "Enter an amount above zero" }, { status: 400 });

  const kind = b.kind === "onetime" ? "onetime" : "recurring";
  const category = VALID_CATEGORIES.has(b.category) ? b.category : "other";

  const expense = await prisma.expense.create({
    data: {
      kind, category, label,
      vendor: b.vendor ? String(b.vendor).trim().slice(0, 120) : null,
      amountCents,
      // A recurring cost with no start date is assumed to have always been running.
      occurredOn: kind === "onetime" ? toDate(b.occurredOn) ?? new Date() : null,
      startedOn: kind === "recurring" ? toDate(b.startedOn) : null,
      endedOn: kind === "recurring" ? toDate(b.endedOn) : null,
      notes: b.notes ? String(b.notes).slice(0, 1000) : null,
    },
  });
  return NextResponse.json({ expense });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (b.label !== undefined) data.label = String(b.label).trim();
  if (b.vendor !== undefined) data.vendor = b.vendor ? String(b.vendor).trim() : null;
  if (b.amount !== undefined) data.amountCents = toCents(b.amount);
  if (b.category !== undefined) data.category = VALID_CATEGORIES.has(b.category) ? b.category : "other";
  if (b.occurredOn !== undefined) data.occurredOn = toDate(b.occurredOn);
  if (b.startedOn !== undefined) data.startedOn = toDate(b.startedOn);
  if (b.endedOn !== undefined) data.endedOn = toDate(b.endedOn);
  if (b.notes !== undefined) data.notes = b.notes ? String(b.notes).slice(0, 1000) : null;

  const expense = await prisma.expense.update({ where: { id }, data });
  return NextResponse.json({ expense });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.expense.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
