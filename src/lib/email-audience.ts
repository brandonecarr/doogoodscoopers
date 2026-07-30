import prisma from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";

// Build a de-duplicated, unsubscribe-filtered email audience from CRM sources.

export interface EmailFilters {
  leadTypes?: string[]; // quote | ad | outofarea | commercial | career | customers | subscribers
  withinDays?: number; // created/started within the last N days
  statuses?: string[]; // lead statuses (applies to lead sources only)
  // Customer sub-filters (only apply to the "customers" source):
  customerFrequencies?: string[]; // weekly | biweekly | twiceweekly | monthly | other
  customerAddon?: "has" | "none"; // has / doesn't have the deodorizing add-on
}

export type SubFreq = "weekly" | "biweekly" | "twiceweekly" | "monthly" | "other";

/** Classify a customer's service frequency from the Sweep&Go plan code (e.g. "2d-1xW",
 *  "1d-bW", "3d-2xW"), falling back to the free-text cleanup frequency. */
export function classifyFrequency(subscriptionNames?: string | null, cleanupFrequency?: string | null): SubFreq {
  const code = (subscriptionNames || "").toLowerCase();
  if (code.includes("2xw")) return "twiceweekly";
  if (code.includes("1xm")) return "monthly";
  if (code.includes("bw")) return "biweekly";
  if (code.includes("1xw")) return "weekly";
  const f = (cleanupFrequency || "").toLowerCase();
  if (/two times a week|twice a week/.test(f)) return "twiceweekly";
  if (/bi.?weekly|every other week|twice per month/.test(f)) return "biweekly";
  if (/once a month|monthly/.test(f)) return "monthly";
  if (/once a week|weekly/.test(f)) return "weekly";
  return "other";
}

/** Whether the customer's subscription includes the sanitizing/deodorizing add-on. */
export function hasDeodorizerAddon(subscriptionNames?: string | null): boolean {
  return /saniti|deodor/i.test(subscriptionNames || "");
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
    const freqs = new Set(filter.customerFrequencies || []);
    const addon = filter.customerAddon;
    const rows = await prisma.sweepandgoCustomer.findMany({
      where: { active: true, email: { not: null }, ...(cutoff ? { startDate: { gte: cutoff } } : {}) },
      select: { id: true, email: true, firstName: true, lastName: true, subscriptionNames: true, cleanupFrequency: true },
    });
    for (const r of rows) {
      if (!r.email) continue;
      if (freqs.size && !freqs.has(classifyFrequency(r.subscriptionNames, r.cleanupFrequency))) continue;
      const hasAddon = hasDeodorizerAddon(r.subscriptionNames);
      if (addon === "has" && !hasAddon) continue;
      if (addon === "none" && hasAddon) continue;
      out.push({ email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, contactType: "customer", contactId: r.id });
    }
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
