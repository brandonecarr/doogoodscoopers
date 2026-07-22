import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

const ALL_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "NO_ANSWER",
  "NOT_INTERESTED",
  "WAITING_FOR_SIGNUP",
  "CONVERTED",
];

// How many cards a column loads at a time on the board.
const PER_COLUMN = 25;

const QUOTE_SELECT = {
  id: true, firstName: true, lastName: true, phone: true, email: true,
  zipCode: true, status: true, grade: true, createdAt: true, followupDate: true, archived: true,
} as const;

const AD_SELECT = {
  id: true, firstName: true, lastName: true, fullName: true, phone: true, email: true,
  zipCode: true, status: true, grade: true, adSource: true, createdAt: true, followupDate: true, archived: true,
} as const;

// Priority sort: A first … F, then ungraded. Then newest within the same grade.
const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
const gradeRank = (g: string | null) => (g ? GRADE_RANK[g] ?? 5 : 9);

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
    const days = Math.max(0, parseInt(searchParams.get("days") || "0")); // 0 = all time
    const sortBy = searchParams.get("sort") === "grade" ? "grade" : "newest";

    const pageSize = 20;
    const statusFilter = status && status !== "all" ? (status as LeadStatus) : undefined;
    const includeQuote = !sourceFilter || sourceFilter === "all" || sourceFilter === "quote";
    const includeAd = !sourceFilter || sourceFilter === "all" || sourceFilter === "ad";
    const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

    // ── Shared where-builders ────────────────────────────────────────────────
    const quoteWhere = (s?: LeadStatus): Record<string, unknown> => {
      const w: Record<string, unknown> = { archived: false };
      if (s) w.status = s;
      if (cutoff) w.createdAt = { gte: cutoff };
      if (search) {
        w.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { zipCode: { contains: search, mode: "insensitive" } },
        ];
      }
      return w;
    };
    const adWhere = (s?: LeadStatus): Record<string, unknown> => {
      const w: Record<string, unknown> = { archived: false };
      if (s) w.status = s;
      if (cutoff) w.createdAt = { gte: cutoff };
      if (search) {
        w.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }
      return w;
    };

    // Per-table order matches the JS comparator so merge+slice stays correct.
    const orderBy: Prisma.QuoteLeadOrderByWithRelationInput[] = sortBy === "grade"
      ? [{ grade: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];
    const adOrderBy = orderBy as unknown as Prisma.AdLeadOrderByWithRelationInput[];
    const cmp = (x: CombinedLead, y: CombinedLead) => {
      if (sortBy === "grade") {
        const g = gradeRank(x.grade) - gradeRank(y.grade);
        if (g !== 0) return g;
      }
      return new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toQuote = (l: any): CombinedLead => ({
      id: l.id, type: "quote", name: `${l.firstName} ${l.lastName || ""}`.trim(),
      phone: l.phone, email: l.email, zipCode: l.zipCode, status: l.status as LeadStatus,
      grade: l.grade, source: "Quote Form", createdAt: l.createdAt.toISOString(),
      followupDate: l.followupDate?.toISOString() || null, archived: l.archived,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toAd = (l: any): CombinedLead => ({
      id: l.id, type: "ad",
      name: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
      phone: l.phone, email: l.email, zipCode: l.zipCode, status: l.status as LeadStatus,
      grade: l.grade, source: l.adSource ? `Meta (${l.adSource})` : "Meta",
      createdAt: l.createdAt.toISOString(), followupDate: l.followupDate?.toISOString() || null,
      archived: l.archived,
    });

    // Top `take` leads for one status (by the active sort), merged across tables, offset by `skip`.
    const fetchStatusPage = async (s: LeadStatus, skip: number, take: number): Promise<CombinedLead[]> => {
      const limit = skip + take;
      const [q, a] = await Promise.all([
        includeQuote ? prisma.quoteLead.findMany({ where: quoteWhere(s), orderBy, take: limit, select: QUOTE_SELECT }) : Promise.resolve([]),
        includeAd ? prisma.adLead.findMany({ where: adWhere(s), orderBy: adOrderBy, take: limit, select: AD_SELECT }) : Promise.resolve([]),
      ]);
      const merged = [...q.map(toQuote), ...a.map(toAd)].sort(cmp);
      return merged.slice(skip, skip + take);
    };

    // ── Kanban view: per-column pagination + counts (never load everything) ──
    if (isKanban) {
      const statuses = statusFilter ? [statusFilter] : ALL_STATUSES;

      // "Load more" for a single column.
      const loadStatus = searchParams.get("loadStatus") as LeadStatus | null;
      if (loadStatus) {
        const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || String(PER_COLUMN))), 100);
        const leads = await fetchStatusPage(loadStatus, offset, limit);
        return NextResponse.json({ leads, status: loadStatus, offset });
      }

      // Counts per status (one grouped query per table).
      const [quoteCounts, adCounts] = await Promise.all([
        includeQuote ? prisma.quoteLead.groupBy({ by: ["status"], where: quoteWhere(), _count: { _all: true } }) : Promise.resolve([]),
        includeAd ? prisma.adLead.groupBy({ by: ["status"], where: adWhere(), _count: { _all: true } }) : Promise.resolve([]),
      ]);
      const counts: Record<string, number> = {};
      for (const s of ALL_STATUSES) counts[s] = 0;
      for (const r of quoteCounts) counts[r.status] = (counts[r.status] || 0) + (r._count?._all || 0);
      for (const r of adCounts) counts[r.status] = (counts[r.status] || 0) + (r._count?._all || 0);

      const pages = await Promise.all(statuses.map((s) => fetchStatusPage(s, 0, PER_COLUMN)));
      const leads = pages.flat();
      const total = statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

      return NextResponse.json({ leads, counts, perColumn: PER_COLUMN, total });
    }

    // ── List view: combined + in-memory pagination ───────────────────────────
    const combined: CombinedLead[] = [];
    const [quoteLeads, adLeads] = await Promise.all([
      includeQuote ? prisma.quoteLead.findMany({ where: quoteWhere(statusFilter), orderBy, select: QUOTE_SELECT }) : Promise.resolve([]),
      includeAd ? prisma.adLead.findMany({ where: adWhere(statusFilter), orderBy: adOrderBy, select: AD_SELECT }) : Promise.resolve([]),
    ]);
    for (const l of quoteLeads) combined.push(toQuote(l));
    for (const l of adLeads) combined.push(toAd(l));
    combined.sort(cmp);

    const total = combined.length;
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
