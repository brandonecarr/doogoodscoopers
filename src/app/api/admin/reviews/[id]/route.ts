import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const STATUSES = ["PENDING", "REQUESTED", "COMPLETED", "DECLINED"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const b = await request.json();
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (typeof b.customerName === "string") data.customerName = b.customerName.trim();
  if ("phone" in b) data.phone = b.phone?.trim() || null;
  if ("email" in b) data.email = b.email?.trim() || null;
  if (typeof b.platform === "string") data.platform = b.platform;
  if ("rating" in b) data.rating = b.rating == null || b.rating === "" ? null : parseInt(b.rating);
  if ("reviewText" in b) data.reviewText = b.reviewText?.trim() || null;
  if ("reviewUrl" in b) data.reviewUrl = b.reviewUrl?.trim() || null;
  if ("notes" in b) data.notes = b.notes?.trim() || null;

  if (typeof b.status === "string" && STATUSES.includes(b.status)) {
    data.status = b.status;
    // Stamp the relevant timestamp when moving into a state for the first time.
    if (b.status === "COMPLETED" && !existing.reviewedAt) data.reviewedAt = now;
    if (b.status === "REQUESTED" && !existing.requestedAt) data.requestedAt = now;
  }

  const review = await prisma.review.update({ where: { id }, data });
  return NextResponse.json({ success: true, review });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
