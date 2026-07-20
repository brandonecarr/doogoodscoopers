import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate } from "@/lib/resend";
import { isOptedOut } from "@/lib/sms-optout";
import type { LeadSource } from "@prisma/client";

const leadTypeMap: Record<string, LeadSource> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
};

type Contact = { phone: string | null; firstName: string | null; lastName: string | null };

async function getLeadContact(mapped: LeadSource, leadId: string): Promise<Contact | null> {
  switch (mapped) {
    case "QUOTE_FORM": {
      const l = await prisma.quoteLead.findUnique({ where: { id: leadId } });
      return l ? { phone: l.phone, firstName: l.firstName, lastName: l.lastName } : null;
    }
    case "OUT_OF_AREA": {
      const l = await prisma.outOfAreaLead.findUnique({ where: { id: leadId } });
      return l ? { phone: l.phone, firstName: l.firstName, lastName: l.lastName } : null;
    }
    case "COMMERCIAL": {
      const l = await prisma.commercialLead.findUnique({ where: { id: leadId } });
      return l ? { phone: l.phone, firstName: l.contactName, lastName: null } : null;
    }
    case "CAREERS": {
      const l = await prisma.careerApplication.findUnique({ where: { id: leadId } });
      return l ? { phone: l.phone, firstName: l.firstName, lastName: l.lastName } : null;
    }
    case "AD_LEAD": {
      const l = await prisma.adLead.findUnique({ where: { id: leadId } });
      return l ? { phone: l.phone, firstName: l.firstName || l.fullName, lastName: l.lastName } : null;
    }
  }
  return null;
}

// GET ?leadId=&leadType= → the message thread (oldest first, for chat display)
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const leadType = searchParams.get("leadType");
  if (!leadId || !leadType) {
    return NextResponse.json({ error: "Missing leadId or leadType" }, { status: 400 });
  }
  const mapped = leadTypeMap[leadType];
  if (!mapped) return NextResponse.json({ error: "Invalid lead type" }, { status: 400 });

  const messages = await prisma.leadMessage.findMany({
    where: { leadId, leadType: mapped },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

// POST { leadId, leadType, body } → send an SMS to the lead + log it
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, leadType, body } = await request.json();
  if (!leadId || !leadType || !body?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const mapped = leadTypeMap[leadType];
  if (!mapped) return NextResponse.json({ error: "Invalid lead type" }, { status: 400 });

  const contact = await getLeadContact(mapped, leadId);
  if (!contact) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!contact.phone) return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });
  if (await isOptedOut(contact.phone)) {
    return NextResponse.json(
      { error: "This lead replied STOP and can no longer be messaged.", optedOut: true },
      { status: 409 }
    );
  }

  // Render {{firstName}}/{{lastName}} against the lead.
  const rendered = renderTemplate(body, {
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
  });

  const result = isQuoConfigured()
    ? await sendSms({ to: contact.phone, body: rendered })
    : { success: false, error: "Quo not configured" as string, messageId: undefined, status: undefined };

  const message = await prisma.leadMessage.create({
    data: {
      leadType: mapped,
      leadId,
      direction: "OUTBOUND",
      body: rendered,
      phone: contact.phone,
      provider: "quo",
      quoMessageId: result.messageId ?? null,
      status: result.success ? result.status || "SENT" : "FAILED",
      adminEmail: session.email,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "MESSAGE_SENT",
      leadType: mapped,
      leadId,
      details: { sent: result.success, error: result.success ? undefined : result.error },
      adminEmail: session.email,
    },
  });

  return NextResponse.json({ success: true, message, sent: result.success, error: result.error });
}
