import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Customers that CAN be added to this campaign: active, not already enrolled,
// and NOT review-completed. Optional ?search= over name/email/phone.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const enrolled = await prisma.campaignRecipient.findMany({
    where: { campaignId: id, leadType: "CUSTOMER" }, select: { leadId: true },
  });
  const enrolledIds = enrolled.map((e) => e.leadId);

  const where: Prisma.SweepandgoCustomerWhereInput = {
    active: true,
    reviewStatus: { not: "REVIEW_COMPLETE" },
    OR: [{ cellPhone: { not: null } }, { homePhone: { not: null } }],
    ...(enrolledIds.length ? { id: { notIn: enrolledIds } } : {}),
  };
  if (search) {
    where.AND = [{
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { cellPhone: { contains: search } },
        { homePhone: { contains: search } },
      ],
    }];
  }

  const rows = await prisma.sweepandgoCustomer.findMany({
    where,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 30,
    select: { id: true, firstName: true, lastName: true, email: true, cellPhone: true, homePhone: true, reviewStatus: true, subscriptionNames: true },
  });

  const customers = rows.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown",
    phone: c.cellPhone || c.homePhone || "",
    email: c.email || "",
    reviewStatus: c.reviewStatus,
    plan: c.subscriptionNames || "",
  }));
  return NextResponse.json({ customers });
}
