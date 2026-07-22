import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { recordUnsubscribe, normalizeEmail } from "@/lib/email-unsubscribe";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json();
  const existing = await prisma.emailContact.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof b.firstName === "string") data.firstName = b.firstName.trim() || null;
  if (typeof b.lastName === "string") data.lastName = b.lastName.trim() || null;
  if (b.status === "SUBSCRIBED" || b.status === "UNSUBSCRIBED") {
    data.status = b.status;
    if (b.status === "UNSUBSCRIBED") await recordUnsubscribe(existing.email, "unsubscribe");
    else await prisma.emailUnsubscribe.deleteMany({ where: { email: normalizeEmail(existing.email) } });
  }
  const contact = await prisma.emailContact.update({ where: { id }, data });
  return NextResponse.json({ success: true, contact });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.emailContact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
