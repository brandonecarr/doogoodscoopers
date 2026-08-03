import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { attributeInstagramLeadToQuote } from "@/lib/instagram-leads";

// POST { instagramLeadId, quoteLeadId } → confirm a click-correlation match.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instagramLeadId, quoteLeadId } = await request.json();
  if (!instagramLeadId || !quoteLeadId) {
    return NextResponse.json({ error: "instagramLeadId and quoteLeadId are required" }, { status: 400 });
  }

  const ok = await attributeInstagramLeadToQuote(instagramLeadId, quoteLeadId);
  if (!ok) return NextResponse.json({ error: "Lead or quote not found" }, { status: 404 });

  await prisma.activityLog.create({
    data: {
      action: "INSTAGRAM_ATTRIBUTED",
      leadType: "INSTAGRAM",
      leadId: instagramLeadId,
      details: { quoteLeadId, confirmedBy: session.email },
      adminEmail: session.email,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
