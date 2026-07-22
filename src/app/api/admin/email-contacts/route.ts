import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "@/lib/email-unsubscribe";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status === "SUBSCRIBED" || status === "UNSUBSCRIBED") where.status = status;
  if (search) where.OR = [
    { email: { contains: search, mode: "insensitive" } },
    { firstName: { contains: search, mode: "insensitive" } },
    { lastName: { contains: search, mode: "insensitive" } },
  ];

  const [contacts, total, subscribed] = await Promise.all([
    prisma.emailContact.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.emailContact.count(),
    prisma.emailContact.count({ where: { status: "SUBSCRIBED" } }),
  ]);
  return NextResponse.json({ contacts, stats: { total, subscribed, unsubscribed: total - subscribed } });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json();
  const email = normalizeEmail(b.email || "");
  if (!email.includes("@")) return NextResponse.json({ error: "Valid email required." }, { status: 400 });

  const data = { firstName: b.firstName?.trim() || null, lastName: b.lastName?.trim() || null, source: b.source || "manual" };
  const contact = await prisma.emailContact.upsert({
    where: { email },
    create: { email, ...data },
    update: data,
  });
  return NextResponse.json({ success: true, contact });
}
