import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Merge prospects under this record as its managed properties. The target
 * becomes a management company; each source is re-parented here — a full record,
 * nothing copied or lost, and reversible via unmerge. A source that was itself a
 * company hands its own managed properties up to this target (one level of
 * nesting only).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { sourceIds } = await request.json().catch(() => ({ sourceIds: [] }));
  const ids: string[] = Array.isArray(sourceIds) ? sourceIds.filter((x) => typeof x === "string" && x !== id) : [];
  if (ids.length === 0) return NextResponse.json({ success: false, error: "Pick at least one property to merge" }, { status: 400 });

  const target = await prisma.commercialProspect.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
  if (target.parentId) return NextResponse.json({ success: false, error: "This record is itself managed by another company — merge into the top-level company instead." }, { status: 400 });

  const sources = await prisma.commercialProspect.findMany({ where: { id: { in: ids } } });
  const ops = [
    // The target is now a management company.
    prisma.commercialProspect.update({ where: { id }, data: { isManagementCompany: true } }),
    // Any properties already managed by a source move up to the target.
    prisma.commercialProspect.updateMany({ where: { parentId: { in: ids } }, data: { parentId: id } }),
    // The sources become managed properties of the target.
    prisma.commercialProspect.updateMany({ where: { id: { in: ids } }, data: { parentId: id, isManagementCompany: false } }),
    prisma.leadUpdate.create({ data: { leadType: "COMMERCIAL_PROSPECT", leadId: id, communicationType: "other", adminEmail: session.email,
      message: `🔗 Merged ${sources.length} propert${sources.length === 1 ? "y" : "ies"} in: ${sources.map((s) => s.propertyName).join(", ")}` } }),
  ];
  await prisma.$transaction(ops);
  return NextResponse.json({ success: true, merged: sources.length });
}

/** Search top-level prospects to merge in (excludes self, this company's children, and archived). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  const where: Record<string, unknown> = { id: { not: id }, parentId: null, status: { not: "ARCHIVED" } };
  if (q) where.OR = ["propertyName", "contactName", "city", "zipCode", "phone", "email", "source"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } }));
  const rows = await prisma.commercialProspect.findMany({ where, orderBy: { propertyName: "asc" }, take: 20,
    select: { id: true, propertyName: true, propertyType: true, city: true, contactName: true, phone: true, isManagementCompany: true, _count: { select: { managedProperties: true } } } });
  return NextResponse.json({ results: rows.map((r) => ({ id: r.id, propertyName: r.propertyName, propertyType: r.propertyType, city: r.city, contactName: r.contactName, phone: r.phone, isCompany: r.isManagementCompany, managed: r._count.managedProperties })) });
}
