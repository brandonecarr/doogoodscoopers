import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseServiceDays } from "@/lib/customer-schedule";

// Route-planning scratchpad persistence. This endpoint ONLY reads/writes the
// local RoutePlanAssignment table — it never calls Sweep&Go and never writes to
// SweepandgoCustomer (which is a one-way read-only mirror).

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.routePlanAssignment.findMany({
    select: { customerId: true, dayOfWeek: true },
  });
  const assignments: Record<string, number> = {};
  for (const r of rows) assignments[r.customerId] = r.dayOfWeek;
  return NextResponse.json({ assignments });
}

// Set (or clear) a single customer's planned day.
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId, dayOfWeek } = await request.json();
  if (!customerId || typeof customerId !== "string") {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  // null → delete the row (revert to the customer's real Sweep&Go day).
  if (dayOfWeek == null) {
    await prisma.routePlanAssignment.deleteMany({ where: { customerId } });
    return NextResponse.json({ success: true, dayOfWeek: null });
  }

  // -1 → explicitly "parked" / unassigned; 0–6 → a weekday.
  if (typeof dayOfWeek !== "number" || dayOfWeek < -1 || dayOfWeek > 6) {
    return NextResponse.json({ error: "dayOfWeek must be -1…6 or null" }, { status: 400 });
  }

  await prisma.routePlanAssignment.upsert({
    where: { customerId },
    create: { customerId, dayOfWeek, updatedBy: session.email },
    update: { dayOfWeek, updatedBy: session.email },
  });
  return NextResponse.json({ success: true, dayOfWeek });
}

// Bulk helpers: seed unassigned customers from their real Sweep&Go days, or wipe
// the whole scratchpad.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json();

  if (action === "clearAll") {
    await prisma.routePlanAssignment.deleteMany({});
    return NextResponse.json({ success: true, cleared: true });
  }

  if (action === "seedFromServiceDays") {
    const existing = await prisma.routePlanAssignment.findMany({ select: { customerId: true } });
    const have = new Set(existing.map((e) => e.customerId));
    const customers = await prisma.sweepandgoCustomer.findMany({
      where: { active: true },
      select: { id: true, serviceDays: true },
    });
    const rows: { customerId: string; dayOfWeek: number; updatedBy: string }[] = [];
    for (const c of customers) {
      if (have.has(c.id)) continue;
      const day = parseServiceDays(c.serviceDays)[0];
      if (day != null) rows.push({ customerId: c.id, dayOfWeek: day, updatedBy: session.email });
    }
    if (rows.length) {
      await prisma.routePlanAssignment.createMany({ data: rows, skipDuplicates: true });
    }
    return NextResponse.json({ success: true, seeded: rows.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
