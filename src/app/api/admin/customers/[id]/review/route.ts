import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED = ["NO_REVIEW", "REQUEST_SENT", "REVIEW_COMPLETE"];

// PATCH → manually set a customer's review status. This is a LOCAL field; it is
// never synced back to Sweep&Go.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reviewStatus } = await request.json();
  if (!ALLOWED.includes(reviewStatus)) {
    return NextResponse.json({ error: "Invalid reviewStatus" }, { status: 400 });
  }
  const customer = await prisma.sweepandgoCustomer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sweepandgoCustomer.update({ where: { id }, data: { reviewStatus } });
  return NextResponse.json({ success: true, reviewStatus });
}
