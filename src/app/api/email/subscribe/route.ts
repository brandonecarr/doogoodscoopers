import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "@/lib/email-unsubscribe";

// Public newsletter signup (e.g. a footer form on the website).
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const email = normalizeEmail(b.email || "");
  if (!email.includes("@")) return NextResponse.json({ error: "Valid email required." }, { status: 400 });

  await prisma.emailContact.upsert({
    where: { email },
    create: { email, firstName: b.firstName?.trim() || null, lastName: b.lastName?.trim() || null, source: "form", status: "SUBSCRIBED" },
    update: { status: "SUBSCRIBED", ...(b.firstName ? { firstName: b.firstName.trim() } : {}) },
  });
  // Opting in clears any prior suppression.
  await prisma.emailUnsubscribe.deleteMany({ where: { email } });

  return NextResponse.json({ success: true });
}
