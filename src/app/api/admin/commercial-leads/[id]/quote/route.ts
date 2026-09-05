import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Save the community-quote inputs on a commercial lead. Replaces the whole record. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { fields?: Record<string, string> };
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Bad payload" }, { status: 400 }); }
  if (!body.fields || typeof body.fields !== "object") return NextResponse.json({ success: false, error: "fields required" }, { status: 400 });
  try {
    const now = new Date();
    await prisma.commercialLead.update({
      where: { id },
      data: { communityQuote: body.fields as Prisma.InputJsonValue, communityQuotedAt: now },
    });
    await prisma.activityLog.create({
      data: { action: "COMMERCIAL_QUOTE_SAVED", leadType: "COMMERCIAL", leadId: id, details: { units: body.fields.units, acres: body.fields.acres, freqPerWeek: body.fields.freqPerWeek }, adminEmail: session.email },
    });
    return NextResponse.json({ success: true, savedAt: now.toISOString() });
  } catch (e) {
    console.error("[commercial quote save]", e);
    return NextResponse.json({ success: false, error: "Could not save quote" }, { status: 500 });
  }
}
