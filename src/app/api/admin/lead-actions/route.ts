import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

type LeadTypeKey = "quote" | "outofarea" | "career" | "commercial" | "adlead";

interface LeadActionData {
  leadId: string;
  leadType: LeadTypeKey;
  action: "archive" | "unarchive" | "delete";
}

const leadTypeMap: Record<LeadTypeKey, LeadSource> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
};

/** Set `archived` on whichever lead table this type lives in. */
async function setArchived(leadType: LeadTypeKey, id: string, archived: boolean) {
  switch (leadType) {
    case "quote":      return prisma.quoteLead.update({ where: { id }, data: { archived } });
    case "adlead":     return prisma.adLead.update({ where: { id }, data: { archived } });
    case "outofarea":  return prisma.outOfAreaLead.update({ where: { id }, data: { archived } });
    case "commercial": return prisma.commercialLead.update({ where: { id }, data: { archived } });
    case "career":     return prisma.careerApplication.update({ where: { id }, data: { archived } });
  }
}

/** Delete the lead row itself. */
async function deleteLead(leadType: LeadTypeKey, id: string) {
  switch (leadType) {
    case "quote":      return prisma.quoteLead.delete({ where: { id } });
    case "adlead":     return prisma.adLead.delete({ where: { id } });
    case "outofarea":  return prisma.outOfAreaLead.delete({ where: { id } });
    case "commercial": return prisma.commercialLead.delete({ where: { id } });
    case "career":     return prisma.careerApplication.delete({ where: { id } });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: LeadActionData = await request.json();

    if (!data.leadId || !data.leadType || !data.action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validActions = ["archive", "unarchive", "delete"];
    if (!validActions.includes(data.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const mappedLeadType = leadTypeMap[data.leadType];
    if (!mappedLeadType) {
      return NextResponse.json({ error: "Invalid lead type" }, { status: 400 });
    }

    if (data.action === "delete") {
      // Remove everything keyed to this lead first, or we leave orphaned rows
      // behind — messages, timeline entries, and live drip enrollments.
      await prisma.$transaction([
        prisma.leadUpdate.deleteMany({ where: { leadId: data.leadId, leadType: mappedLeadType } }),
        prisma.leadMessage.deleteMany({ where: { leadId: data.leadId, leadType: mappedLeadType } }),
        prisma.campaignRecipient.deleteMany({ where: { leadId: data.leadId, leadType: mappedLeadType } }),
      ]);

      await deleteLead(data.leadType, data.leadId);

      await prisma.activityLog.create({
        data: {
          action: "LEAD_DELETED",
          leadType: mappedLeadType,
          leadId: data.leadId,
          details: { deletedAt: new Date().toISOString() },
          adminEmail: session.email,
        },
      });

      return NextResponse.json({ success: true, action: "deleted" });
    }

    if (data.action === "archive" || data.action === "unarchive") {
      const archived = data.action === "archive";
      await setArchived(data.leadType, data.leadId, archived);

      await prisma.activityLog.create({
        data: {
          action: archived ? "LEAD_ARCHIVED" : "LEAD_UNARCHIVED",
          leadType: mappedLeadType,
          leadId: data.leadId,
          details: { archived },
          adminEmail: session.email,
        },
      });

      return NextResponse.json({ success: true, action: data.action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error performing lead action:", error);
    const message = error instanceof Error ? error.message : "Failed to perform action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
