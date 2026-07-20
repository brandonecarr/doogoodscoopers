import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { mergeLeads, leadTypeMap } from "@/lib/lead-duplicates";

// POST { leadType: "quote"|"adlead", survivorId, mergeIds: [] }
// Consolidate same-type duplicates into the survivor, preserving all data.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadType, survivorId, mergeIds } = await request.json();
  if ((leadType !== "quote" && leadType !== "adlead") || !survivorId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
    return NextResponse.json({ error: "leadType (quote|adlead), survivorId and mergeIds are required" }, { status: 400 });
  }
  if (mergeIds.includes(survivorId)) {
    return NextResponse.json({ error: "Survivor cannot be in mergeIds" }, { status: 400 });
  }

  try {
    const result = await mergeLeads(leadType, survivorId, mergeIds);
    await prisma.activityLog.create({
      data: {
        action: "LEADS_MERGED",
        leadType: leadTypeMap[leadType as "quote" | "adlead"],
        leadId: survivorId,
        details: { mergedIds: mergeIds, mergedCount: result.merged },
        adminEmail: session.email,
      },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("Lead merge failed:", e);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
