import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

type LeadTypeKey = "quote" | "outofarea" | "career" | "commercial" | "adlead" | "canvasser";

interface LeadActionData {
  leadId: string;
  leadType: LeadTypeKey;
  action: "archive" | "unarchive" | "delete" | "move-out-of-area";
}

/** Lead types that can be moved into the out-of-area list. */
const MOVABLE_TO_OUT_OF_AREA: LeadTypeKey[] = ["quote", "adlead"];

const leadTypeMap: Record<LeadTypeKey, LeadSource> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
  canvasser: "CANVASSER",
};

/** Set `archived` on whichever lead table this type lives in. */
async function setArchived(leadType: LeadTypeKey, id: string, archived: boolean) {
  switch (leadType) {
    case "quote":      return prisma.quoteLead.update({ where: { id }, data: { archived } });
    case "adlead":     return prisma.adLead.update({ where: { id }, data: { archived } });
    case "outofarea":  return prisma.outOfAreaLead.update({ where: { id }, data: { archived } });
    case "commercial": return prisma.commercialLead.update({ where: { id }, data: { archived } });
    case "career":     return prisma.careerApplication.update({ where: { id }, data: { archived } });
    case "canvasser":  return prisma.canvasserLead.update({ where: { id }, data: { archived } });
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
    case "canvasser":  return prisma.canvasserLead.delete({ where: { id } });
  }
}

/**
 * Move a prospect we don't service yet into the out-of-area list.
 *
 * Meta feeds us leads from well outside the route, and they shouldn't sit in the
 * working pipeline or keep receiving a drip that promises service. This parks
 * them where they can be picked back up when a route opens in their area.
 *
 * The person's history follows them — timeline entries and messages are
 * re-pointed at the new record. Any live drip is stopped (the copy is wrong for
 * someone we can't serve). The original row is archived rather than deleted, so
 * ad attribution and the original submission survive.
 */
async function moveToOutOfArea(leadType: LeadTypeKey, id: string, adminEmail: string) {
  const src =
    leadType === "quote"
      ? await prisma.quoteLead.findUnique({ where: { id } })
      : await prisma.adLead.findUnique({ where: { id } });
  if (!src) throw new Error("Lead not found");

  // OutOfAreaLead requires these; ad leads can arrive with any of them blank.
  const first = src.firstName || "";
  const last =
    src.lastName || ("fullName" in src ? (src.fullName || "").split(" ").slice(1).join(" ") : "");
  const name = [first, last].filter(Boolean).join(" ") || "Unknown";

  const origin =
    leadType === "quote"
      ? "Moved from Quote Leads"
      : `Moved from Meta Ad Leads${"adSource" in src && src.adSource ? ` (${src.adSource})` : ""}`;
  const carried = [origin, src.notes?.trim()].filter(Boolean).join("\n\n");

  const created = await prisma.outOfAreaLead.create({
    data: {
      firstName: first || name,
      lastName: last,
      email: src.email || "",
      phone: src.phone || "",
      zipCode: src.zipCode || "",
      notes: carried || null,
      grade: src.grade ?? null,
      followupDate: src.followupDate ?? null,
    },
  });

  const from = leadTypeMap[leadType];
  await prisma.$transaction([
    // History follows the person to their new record.
    prisma.leadUpdate.updateMany({
      where: { leadId: id, leadType: from },
      data: { leadId: created.id, leadType: "OUT_OF_AREA" },
    }),
    prisma.leadMessage.updateMany({
      where: { leadId: id, leadType: from },
      data: { leadId: created.id, leadType: "OUT_OF_AREA" },
    }),
    // Stop any live sequence — we can't service them, so the copy is wrong.
    prisma.campaignRecipient.updateMany({
      where: { leadId: id, leadType: from, status: "ACTIVE" },
      data: { status: "STOPPED", nextSendAt: null, error: "Moved to out of area" },
    }),
  ]);

  // Breadcrumbs in both directions.
  await prisma.leadUpdate.create({
    data: {
      leadType: "OUT_OF_AREA",
      leadId: created.id,
      message: `📍 ${origin}. Outside the current service area — pick back up when a route opens near ${src.zipCode || "this zip"}.`,
      communicationType: "other",
      adminEmail,
    },
  });

  if (leadType === "quote") {
    await prisma.quoteLead.update({ where: { id }, data: { archived: true } });
  } else {
    await prisma.adLead.update({ where: { id }, data: { archived: true } });
  }

  await prisma.activityLog.create({
    data: {
      action: "LEAD_MOVED_OUT_OF_AREA",
      leadType: from,
      leadId: id,
      details: { movedTo: created.id, zipCode: src.zipCode ?? null },
      adminEmail,
    },
  });

  return created.id;
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

    const validActions = ["archive", "unarchive", "delete", "move-out-of-area"];
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

    if (data.action === "move-out-of-area") {
      if (!MOVABLE_TO_OUT_OF_AREA.includes(data.leadType)) {
        return NextResponse.json(
          { error: "Only quote and ad leads can be moved to out of area" },
          { status: 400 }
        );
      }
      const outOfAreaId = await moveToOutOfArea(data.leadType, data.leadId, session.email);
      return NextResponse.json({ success: true, action: "moved", outOfAreaId });
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
