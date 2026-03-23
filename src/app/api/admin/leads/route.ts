import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";

export interface CombinedLead {
  id: string;
  type: "quote" | "ad";
  name: string;
  phone: string | null;
  email: string | null;
  zipCode: string | null;
  status: LeadStatus;
  grade: string | null;
  source: string;
  createdAt: string;
  followupDate: string | null;
  archived: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sourceFilter = searchParams.get("source"); // "quote" | "ad" | "all"
    const page = parseInt(searchParams.get("page") || "1");
    const isKanban = searchParams.get("view") === "kanban";

    const pageSize = 20;
    const statusFilter = status && status !== "all" ? (status as LeadStatus) : undefined;
    const combined: CombinedLead[] = [];

    // ── Quote Leads ──────────────────────────────────────────────────────────
    if (!sourceFilter || sourceFilter === "all" || sourceFilter === "quote") {
      const where: Record<string, unknown> = { archived: false };
      if (statusFilter) where.status = statusFilter;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { zipCode: { contains: search, mode: "insensitive" } },
        ];
      }
      const leads = await prisma.quoteLead.findMany({ where, orderBy: { createdAt: "desc" } });
      for (const l of leads) {
        combined.push({
          id: l.id,
          type: "quote",
          name: `${l.firstName} ${l.lastName || ""}`.trim(),
          phone: l.phone,
          email: l.email,
          zipCode: l.zipCode,
          status: l.status as LeadStatus,
          grade: l.grade,
          source: "Quote Form",
          createdAt: l.createdAt.toISOString(),
          followupDate: l.followupDate?.toISOString() || null,
          archived: l.archived,
        });
      }
    }

    // ── Ad Leads ─────────────────────────────────────────────────────────────
    if (!sourceFilter || sourceFilter === "all" || sourceFilter === "ad") {
      const where: Record<string, unknown> = { archived: false };
      if (statusFilter) where.status = statusFilter;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }
      const leads = await prisma.adLead.findMany({ where, orderBy: { createdAt: "desc" } });
      for (const l of leads) {
        const nameParts = `${l.firstName || ""} ${l.lastName || ""}`.trim();
        combined.push({
          id: l.id,
          type: "ad",
          name: l.fullName || nameParts || "Unknown",
          phone: l.phone,
          email: l.email,
          zipCode: l.zipCode,
          status: l.status as LeadStatus,
          grade: l.grade,
          source: l.adSource ? `Meta (${l.adSource})` : "Meta",
          createdAt: l.createdAt.toISOString(),
          followupDate: l.followupDate?.toISOString() || null,
          archived: l.archived,
        });
      }
    }

    // Sort newest first across both types
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = combined.length;

    // Kanban: return all (no pagination)
    if (isKanban) {
      return NextResponse.json({ leads: combined, total });
    }

    // List: paginate in memory
    const skip = (page - 1) * pageSize;
    return NextResponse.json({
      leads: combined.slice(skip, skip + pageSize),
      total,
      pageSize,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching combined leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
