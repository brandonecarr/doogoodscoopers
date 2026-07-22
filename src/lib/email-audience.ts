import prisma from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";

// Build a de-duplicated, unsubscribe-filtered email audience from CRM sources.

export interface EmailFilters {
  leadTypes?: string[]; // quote | ad | outofarea | commercial | career | customers | subscribers
  withinDays?: number; // created/started within the last N days
  statuses?: string[]; // lead statuses (applies to lead sources only)
}

export interface EmailRecipientData {
  email: string;
  name: string | null;
  contactType: string;
  contactId: string;
}

export async function buildEmailRecipients(filter: EmailFilters): Promise<EmailRecipientData[]> {
  const types = new Set(filter.leadTypes || []);
  const cutoff = filter.withinDays && filter.withinDays > 0 ? new Date(Date.now() - filter.withinDays * 86_400_000) : null;
  const statusWhere = filter.statuses?.length ? { status: { in: filter.statuses as LeadStatus[] } } : {};
  const dateWhere = cutoff ? { createdAt: { gte: cutoff } } : {};
  const out: EmailRecipientData[] = [];

  if (types.has("quote")) {
    const rows = await prisma.quoteLead.findMany({ where: { archived: false, email: { not: null }, ...statusWhere, ...dateWhere }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "quote", contactId: r.id });
  }
  if (types.has("ad")) {
    const rows = await prisma.adLead.findMany({ where: { archived: false, email: { not: null }, ...statusWhere, ...dateWhere }, select: { id: true, email: true, firstName: true, lastName: true, fullName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "ad", contactId: r.id });
  }
  if (types.has("outofarea")) {
    const rows = await prisma.outOfAreaLead.findMany({ where: { archived: false, ...statusWhere, ...dateWhere }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "outofarea", contactId: r.id });
  }
  if (types.has("commercial")) {
    const rows = await prisma.commercialLead.findMany({ where: { archived: false, ...statusWhere, ...dateWhere }, select: { id: true, email: true, contactName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: r.contactName, contactType: "commercial", contactId: r.id });
  }
  if (types.has("career")) {
    const rows = await prisma.careerApplication.findMany({ where: { archived: false, ...statusWhere, ...dateWhere }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "career", contactId: r.id });
  }
  if (types.has("customers")) {
    const rows = await prisma.sweepandgoCustomer.findMany({ where: { active: true, email: { not: null }, ...(cutoff ? { startDate: { gte: cutoff } } : {}) }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "customer", contactId: r.id });
  }
  if (types.has("subscribers")) {
    const rows = await prisma.emailContact.findMany({ where: { status: "SUBSCRIBED" }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "contact", contactId: r.id });
  }

  // De-dupe by normalized email (first wins) and drop unsubscribed.
  const unsub = await unsubscribedSet();
  const seen = new Set<string>();
  const result: EmailRecipientData[] = [];
  for (const r of out) {
    const key = normalizeEmail(r.email);
    if (!key || !key.includes("@") || seen.has(key) || unsub.has(key)) continue;
    seen.add(key);
    result.push({ ...r, email: r.email.trim() });
  }
  return result;
}
