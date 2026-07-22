import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeEmail, recordUnsubscribe } from "@/lib/email-unsubscribe";

// Bulk import contacts (e.g. from a Brevo/CSV export). Preserves unsubscribes.
// Body: { contacts: [{ email, firstName?, lastName?, unsubscribed? }] }

interface Row { email?: string; firstName?: string; lastName?: string; unsubscribed?: boolean }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contacts } = (await request.json()) as { contacts: Row[] };
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "No contacts to import." }, { status: 400 });
  }

  let imported = 0, unsub = 0, skipped = 0;
  const seen = new Set<string>();

  for (const r of contacts.slice(0, 20000)) {
    const email = normalizeEmail(r.email || "");
    if (!email.includes("@") || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    const status = r.unsubscribed ? "UNSUBSCRIBED" : "SUBSCRIBED";
    const data = { firstName: r.firstName?.trim() || null, lastName: r.lastName?.trim() || null, source: "import", status };
    await prisma.emailContact.upsert({ where: { email }, create: { email, ...data }, update: data });
    if (r.unsubscribed) { await recordUnsubscribe(email, "unsubscribe"); unsub++; }
    imported++;
  }

  return NextResponse.json({ success: true, imported, unsubscribed: unsub, skipped });
}
