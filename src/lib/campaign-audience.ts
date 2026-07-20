import prisma from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/quo";
import type { LeadSource } from "@prisma/client";

/**
 * Campaign audience: turn a set of filters into a de-duplicated list of
 * recipients across the different lead tables. Used by the preview and create
 * campaign routes so the count you see is exactly what gets sent.
 */

export interface AudienceFilter {
  // Which lead sources to include (any of these).
  leadTypes: string[]; // "quote" | "manual" | "meta" | "outofarea" | "commercial"
  statuses?: string[]; // LeadStatus values
  grades?: string[]; // "A".."F"
  withinDays?: number; // only leads created within the last N days
}

export interface Recipient {
  leadType: LeadSource;
  leadId: string;
  name: string | null;
  phone: string;
  status: string | null;
  grade: string | null;
  createdAt: string;
}

function commonWhere(filters: AudienceFilter) {
  const where: Record<string, unknown> = { archived: false };
  if (filters.statuses?.length) where.status = { in: filters.statuses };
  if (filters.grades?.length) where.grade = { in: filters.grades };
  if (filters.withinDays && filters.withinDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - filters.withinDays * 24 * 3600 * 1000) };
  }
  return where;
}

export async function buildRecipients(filters: AudienceFilter): Promise<Recipient[]> {
  const types = new Set(filters.leadTypes);
  const base = commonWhere(filters);
  const out: Recipient[] = [];

  const push = (
    leadType: LeadSource,
    rows: Array<{ id: string; phone: string | null; name: string | null; status: string | null; grade: string | null; createdAt: Date }>
  ) => {
    for (const r of rows) {
      if (!r.phone) continue;
      out.push({
        leadType,
        leadId: r.id,
        name: r.name,
        phone: r.phone,
        status: r.status,
        grade: r.grade,
        createdAt: r.createdAt.toISOString(),
      });
    }
  };

  // QuoteLead — split into web quote form vs manual entry by lastStep.
  if (types.has("quote") || types.has("manual")) {
    const rows = await prisma.quoteLead.findMany({
      where: {
        ...base,
        ...(types.has("quote") && types.has("manual")
          ? {}
          : types.has("manual")
            ? { lastStep: "Manual Entry" }
            : { NOT: { lastStep: "Manual Entry" } }),
      },
      select: { id: true, phone: true, firstName: true, lastName: true, status: true, grade: true, createdAt: true },
    });
    push(
      "QUOTE_FORM",
      rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
        status: r.status,
        grade: r.grade,
        createdAt: r.createdAt,
      }))
    );
  }

  if (types.has("meta")) {
    const rows = await prisma.adLead.findMany({
      where: base,
      select: { id: true, phone: true, firstName: true, lastName: true, fullName: true, status: true, grade: true, createdAt: true },
    });
    push(
      "AD_LEAD",
      rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
        status: r.status,
        grade: r.grade,
        createdAt: r.createdAt,
      }))
    );
  }

  if (types.has("outofarea")) {
    const rows = await prisma.outOfAreaLead.findMany({
      where: base,
      select: { id: true, phone: true, firstName: true, lastName: true, status: true, grade: true, createdAt: true },
    });
    push(
      "OUT_OF_AREA",
      rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
        status: r.status,
        grade: r.grade,
        createdAt: r.createdAt,
      }))
    );
  }

  if (types.has("commercial")) {
    const rows = await prisma.commercialLead.findMany({
      where: base,
      select: { id: true, phone: true, contactName: true, status: true, grade: true, createdAt: true },
    });
    push(
      "COMMERCIAL",
      rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: r.contactName,
        status: r.status,
        grade: r.grade,
        createdAt: r.createdAt,
      }))
    );
  }

  // De-dupe by normalized phone (one text per person), keep the first occurrence.
  const seen = new Set<string>();
  const deduped: Recipient[] = [];
  for (const r of out) {
    const key = normalizePhoneNumber(r.phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  return deduped;
}
