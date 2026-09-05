import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PROSPECT_TYPES, type ProspectType } from "@/lib/commercial-prospects";

type Body = { action: "attempt" | "archive" | "unarchive" | "edit"; note?: string } & Record<string, unknown>;

/** Call-list actions: log an attempt, archive/unarchive, or edit the fields. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let b: Body;
  try { b = await request.json(); } catch { return NextResponse.json({ success: false, error: "Bad payload" }, { status: 400 }); }
  const p = await prisma.commercialProspect.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  try {
    if (b.action === "attempt") {
      const line = `${stamp} — call attempt${b.note ? `: ${String(b.note).trim()}` : ""}`;
      await prisma.commercialProspect.update({ where: { id }, data: {
        attempts: { increment: 1 }, lastAttemptAt: new Date(), status: p.status === "TO_CALL" ? "ATTEMPTED" : p.status,
        notes: [p.notes, line].filter(Boolean).join("\n") } });
    } else if (b.action === "archive") {
      const line = `${stamp} — archived${b.note ? `: ${String(b.note).trim()}` : ""}`;
      await prisma.commercialProspect.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date(), notes: [p.notes, line].filter(Boolean).join("\n") } });
    } else if (b.action === "unarchive") {
      await prisma.commercialProspect.update({ where: { id }, data: { status: p.attempts > 0 ? "ATTEMPTED" : "TO_CALL", archivedAt: null } });
    } else if (b.action === "edit") {
      const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : undefined);
      const propertyType = s("propertyType"); const unitsRaw = s("units");
      if (!s("propertyName") || !s("city")) return NextResponse.json({ success: false, error: "Property and city are required" }, { status: 400 });
      await prisma.commercialProspect.update({ where: { id }, data: {
        propertyName: s("propertyName")!, propertyType: (PROSPECT_TYPES as readonly string[]).includes(propertyType || "") ? (propertyType as ProspectType) : p.propertyType,
        contactName: s("contactName") || null, phone: s("phone") || null, email: s("email") || null, city: s("city")!, state: (s("state") || "CA").toUpperCase().slice(0, 2),
        zipCode: s("zipCode") || "", address: s("address") || null, units: unitsRaw ? parseInt(unitsRaw, 10) || null : null, notes: s("notes") || null, source: s("source") || null } });
    } else return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[commercial-prospect patch]", e);
    return NextResponse.json({ success: false, error: "Could not update" }, { status: 500 });
  }
}
