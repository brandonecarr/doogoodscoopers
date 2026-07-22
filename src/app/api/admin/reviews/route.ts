import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Reviews: request-and-outcome tracking (Google, etc). Manual entry now; the
// auto-request flow will create rows here after a customer's first cleanup.

const STATUSES = ["PENDING", "REQUESTED", "COMPLETED", "DECLINED"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status && STATUSES.includes(status)) where.status = status;
  if (platform && platform !== "all") where.platform = platform;
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [reviews, total, completed, requested, declined, avg] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.review.count(),
    prisma.review.count({ where: { status: "COMPLETED" } }),
    prisma.review.count({ where: { status: { in: ["PENDING", "REQUESTED"] } } }),
    prisma.review.count({ where: { status: "DECLINED" } }),
    prisma.review.aggregate({ _avg: { rating: true }, where: { status: "COMPLETED", rating: { not: null } } }),
  ]);

  return NextResponse.json({
    reviews,
    stats: {
      total,
      completed,
      requested,
      declined,
      avgRating: avg._avg.rating ? Math.round(avg._avg.rating * 10) / 10 : null,
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json();
  if (!b.customerName?.trim()) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }
  const status = STATUSES.includes(b.status) ? b.status : "REQUESTED";
  const now = new Date();

  const review = await prisma.review.create({
    data: {
      customerName: b.customerName.trim(),
      phone: b.phone?.trim() || null,
      email: b.email?.trim() || null,
      sngCustomerId: b.sngCustomerId || null,
      platform: b.platform || "google",
      status,
      rating: typeof b.rating === "number" ? b.rating : b.rating ? parseInt(b.rating) : null,
      reviewText: b.reviewText?.trim() || null,
      reviewUrl: b.reviewUrl?.trim() || null,
      requestChannel: b.requestChannel || "manual",
      notes: b.notes?.trim() || null,
      requestedAt: b.requestedAt ? new Date(b.requestedAt) : status === "REQUESTED" ? now : null,
      reviewedAt: b.reviewedAt ? new Date(b.reviewedAt) : status === "COMPLETED" ? now : null,
    },
  });
  return NextResponse.json({ success: true, review });
}
