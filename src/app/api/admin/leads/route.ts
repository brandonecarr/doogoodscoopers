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
    const includeQuote = !sourceFilter || sourceFilter === "all" || sourceFilter === "quote";
    const includeAd = !sourceFilter || sourceFilter === "all" || sourceFilter === "ad";

    // ── Shared where-builders ────────────────────────────────────────────────
    const quoteWhere = (s?: LeadStatus): Record<string, unknown> => {
      const w: Record<string, unknown> = { archived: false };
      if (s) w.status = s;
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

    // Newest `take` leads for one status, merged across both tables, offset by `skip`.
    const fetchStatusPage = async (s: LeadStatus, skip: number, take: number): Promise<CombinedLead[]> => {
      const limit = skip + take;
      const [q, a] = await Promise.all([
        includeQuote ? prisma.quoteLead.findMany({ where: quoteWhere(s), orderBy: { createdAt: "desc" }, take: limit, select: QUOTE_SELECT }) : Promise.resolve([]),
        includeAd ? prisma.adLead.findMany({ where: adWhere(s), orderBy: { createdAt: "desc" }, take: limit, select: AD_SELECT }) : Promise.resolve([]),
      ]);
      const merged = [...q.map(toQuote), ...a.map(toAd)];
      merged.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      return merged.slice(skip, skip + take);
    };

    // ── Kanban view: per-column pagination + counts (never load everything) ──
    if (isKanban) {
      const statuses = statusFilter ? [statusFilter] : ALL_STATUSES;

      // "Load more" for a single column.
      const loadStatus = searchParams.get("loadStatus") as LeadStatus | null;
      if (loadStatus) {
        const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
        const leads = await fetchStatusPage(loadStatus, offset, PER_COLUMN);
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

      // First page of each visible column.
      const pages = await Promise.all(statuses.map((s) => fetchStatusPage(s, 0, PER_COLUMN)));
      const leads = pages.flat();
      const total = statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

      return NextResponse.json({ leads, counts, perColumn: PER_COLUMN, total });
    }

    // ── List view: combined + in-memory pagination ───────────────────────────
    const combined: CombinedLead[] = [];
    const [quoteLeads, adLeads] = await Promise.all([
      includeQuote ? prisma.quoteLead.findMany({ where: quoteWhere(statusFilter), orderBy: { createdAt: "desc" }, select: QUOTE_SELECT }) : Promise.resolve([]),
      includeAd ? prisma.adLead.findMany({ where: adWhere(statusFilter), orderBy: { createdAt: "desc" }, select: AD_SELECT }) : Promise.resolve([]),
    ]);
    for (const l of quoteLeads) combined.push(toQuote(l));
    for (const l of adLeads) combined.push(toAd(l));
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
