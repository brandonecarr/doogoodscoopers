import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findDuplicates, leadTypeMap, type WireLeadType } from "@/lib/lead-duplicates";

// GET ?leadId=&leadType= → other leads sharing this lead's phone number.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const leadType = searchParams.get("leadType") as WireLeadType | null;
  if (!leadId || !leadType || !(leadType in leadTypeMap)) {
    return NextResponse.json({ error: "Missing or invalid leadId/leadType" }, { status: 400 });
  }

  const duplicates = await findDuplicates(leadType, leadId);
  return NextResponse.json({ duplicates });
}
