import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { LeadStatus } from "@/types/leads";

// Bulk actions from the leads board: archive, move status, or set grade on many
// quote/ad leads at once. Reuses the same fields as the single-lead actions.

type BulkLeadType = "quote" | "ad" | "instagram" | "canvasser";

interface BulkBody {
  action: "archive" | "status" | "grade";
  leads: { type: BulkLeadType; id: string }[];
  status?: LeadStatus;
  grade?: string | null;
}

const SOURCE_FOR: Record<BulkLeadType, "QUOTE_FORM" | "AD_LEAD" | "INSTAGRAM" | "CANVASSER"> = {
  quote: "QUOTE_FORM", ad: "AD_LEAD", instagram: "INSTAGRAM", canvasser: "CANVASSER",
};

const VALID_STATUSES = ["NEW", "CONTACTED", "NO_ANSWER", "NOT_INTERESTED", "WAITING_FOR_SIGNUP", "CONVERTED"];
const VALID_GRADES = ["A", "B", "C", "D", "F"];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: BulkBody = await request.json();
    const { action, leads } = body;
    if (!action || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "Missing action or leads" }, { status: 400 });
    }

    // Build the update payload + activity label for the chosen action.
    // Fields used (archived/status/grade) are common to every lead table.
    let data: Prisma.QuoteLeadUpdateManyMutationInput & Prisma.AdLeadUpdateManyMutationInput & Prisma.CanvasserLeadUpdateManyMutationInput;
    let logAction: string;
    let details: Prisma.InputJsonValue;
    if (action === "archive") {
      data = { archived: true };
      logAction = "LEAD_ARCHIVED";
      details = { bulk: true, archived: true };
    } else if (action === "status") {
      if (!body.status || !VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data = { status: body.status };
      logAction = "STATUS_UPDATE";
      details = { bulk: true, status: body.status };
    } else if (action === "grade") {
      if (body.grade != null && !VALID_GRADES.includes(body.grade)) {
        return NextResponse.json({ error: "Invalid grade" }, { status: 400 });
      }
      data = { grade: body.grade ?? null };
      logAction = "GRADE_UPDATE";
      details = { bulk: true, grade: body.grade ?? null };
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const idsOf = (t: BulkLeadType) => leads.filter((l) => l.type === t).map((l) => l.id);
    const quoteIds = idsOf("quote");
    const adIds = idsOf("ad");
    const instaIds = idsOf("instagram");
    const canvIds = idsOf("canvasser");

    const ops = [];
    if (quoteIds.length) ops.push(prisma.quoteLead.updateMany({ where: { id: { in: quoteIds } }, data }));
    if (adIds.length) ops.push(prisma.adLead.updateMany({ where: { id: { in: adIds } }, data }));
    if (instaIds.length) ops.push(prisma.instagramLead.updateMany({ where: { id: { in: instaIds } }, data }));
    if (canvIds.length) ops.push(prisma.canvasserLead.updateMany({ where: { id: { in: canvIds } }, data }));
    await Promise.all(ops);

    // One activity-log row per lead, mirroring single-lead actions.
    const logs: Prisma.ActivityLogCreateManyInput[] = leads.map((l) => ({
      action: logAction,
      leadType: SOURCE_FOR[l.type] ?? "QUOTE_FORM",
      leadId: l.id,
      details,
      adminEmail: session.email,
    }));
    await prisma.activityLog.createMany({ data: logs });

    return NextResponse.json({ success: true, updated: leads.length });
  } catch (error) {
    console.error("Bulk lead action failed:", error);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
