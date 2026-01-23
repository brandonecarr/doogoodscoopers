import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface LeadActionData {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  action: "archive" | "unarchive" | "delete";
}

const leadTypeMap: Record<string, "QUOTE_FORM" | "OUT_OF_AREA" | "CAREERS" | "COMMERCIAL" | "AD_LEAD"> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data: LeadActionData = await request.json();

    if (!data.leadId || !data.leadType || !data.action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const validActions = ["archive", "unarchive", "delete"];
    if (!validActions.includes(data.action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const mappedLeadType = leadTypeMap[data.leadType];
    if (!mappedLeadType) {
      return NextResponse.json(
        { error: "Invalid lead type" },
        { status: 400 }
      );
    }

    // Currently only supporting quote leads for archive/delete
    if (data.leadType !== "quote") {
      return NextResponse.json(
        { error: "Archive/delete only supported for quote leads" },
        { status: 400 }
      );
    }

    if (data.action === "delete") {
      // Delete related updates first
      await prisma.leadUpdate.deleteMany({
        where: {
          leadId: data.leadId,
          leadType: mappedLeadType,
        },
      });

      // Delete the lead
      await prisma.quoteLead.delete({
        where: { id: data.leadId },
      });

      // Log the activity
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

      await prisma.quoteLead.update({
        where: { id: data.leadId },
        data: { archived },
      });

      // Log the activity
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

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error performing lead action:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}
