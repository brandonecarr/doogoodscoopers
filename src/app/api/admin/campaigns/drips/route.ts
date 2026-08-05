import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Active DRIP campaigns — for the "Add to campaign" picker on a customer profile.
// Flags which ones already target customers via their trigger.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.campaign.findMany({
    where: { type: "DRIP", active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, audienceFilter: true },
  });
  const drips = rows.map((r) => {
    const leadTypes = ((r.audienceFilter as { leadTypes?: string[] } | null)?.leadTypes) || [];
    return { id: r.id, name: r.name, targetsCustomers: leadTypes.includes("customers") };
  });
  return NextResponse.json({ drips });
}
