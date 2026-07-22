import prisma from "@/lib/prisma";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import type { LeadSource } from "@prisma/client";

/**
 * Drip-campaign enrollment. A drip auto-enrolls NEW leads (created after the
 * campaign was created) whose type matches the campaign trigger. Excludes leads
 * that are archived, opted out, or already enrolled.
 */

export interface DripCandidate {
  leadType: LeadSource;
  leadId: string;
  phone: string;
  name: string | null;
}

interface DripCampaign {
  id: string;
  createdAt: Date;
  audienceFilter: unknown;
}

export async function findDripCandidates(campaign: DripCampaign): Promise<DripCandidate[]> {
  const filter = (campaign.audienceFilter || {}) as { leadTypes?: string[] };
  const types = new Set(filter.leadTypes || []);
  if (types.size === 0) return [];
  const since = campaign.createdAt;
  const base = { archived: false, createdAt: { gt: since } };
  const out: DripCandidate[] = [];

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
      select: { id: true, phone: true, firstName: true, lastName: true },
    });
    for (const r of rows) out.push({ leadType: "QUOTE_FORM", leadId: r.id, phone: r.phone, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("meta")) {
    const rows = await prisma.adLead.findMany({ where: base, select: { id: true, phone: true, firstName: true, lastName: true, fullName: true } });
    for (const r of rows) out.push({ leadType: "AD_LEAD", leadId: r.id, phone: r.phone || "", name: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("outofarea")) {
    const rows = await prisma.outOfAreaLead.findMany({ where: base, select: { id: true, phone: true, firstName: true, lastName: true } });
    for (const r of rows) out.push({ leadType: "OUT_OF_AREA", leadId: r.id, phone: r.phone, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("commercial")) {
    const rows = await prisma.commercialLead.findMany({ where: base, select: { id: true, phone: true, contactName: true } });
    for (const r of rows) out.push({ leadType: "COMMERCIAL", leadId: r.id, phone: r.phone, name: r.contactName });
  }
  // Sweep&Go customers (for review-request / customer drips). Enrolls customers
  // that appeared in the mirror after the campaign started; delay steps mean the
  // request lands a set time after they became a customer (≈ after first cleanup).
  if (types.has("customers")) {
    const rows = await prisma.sweepandgoCustomer.findMany({
      where: { active: true, firstSeenAt: { gt: since } },
      select: { id: true, cellPhone: true, homePhone: true, firstName: true, lastName: true },
    });
    for (const r of rows) out.push({
      leadType: "CUSTOMER",
      leadId: r.id,
      phone: r.cellPhone || r.homePhone || "",
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
    });
  }

  // Exclude already-enrolled, phone-less, and opted-out.
  const enrolled = await prisma.campaignRecipient.findMany({ where: { campaignId: campaign.id }, select: { leadType: true, leadId: true } });
  const enrolledSet = new Set(enrolled.map((e) => `${e.leadType}:${e.leadId}`));
  const optedOut = await optedOutKeys();
  return out.filter((c) => {
    if (!c.phone || enrolledSet.has(`${c.leadType}:${c.leadId}`)) return false;
    const k = optOutKey(c.phone);
    return !k || !optedOut.has(k);
  });
}

/** Whether a lead has been archived (drip should stop). */
export async function isLeadArchived(leadType: LeadSource, leadId: string): Promise<boolean> {
  if (leadType === "CUSTOMER") {
    // A customer that cancelled (active=false) or vanished from the mirror stops the drip.
    const row = await prisma.sweepandgoCustomer.findUnique({ where: { id: leadId }, select: { active: true } });
    return row ? !row.active : true;
  }
  const sel = { select: { archived: true } };
  let row: { archived: boolean } | null = null;
  if (leadType === "QUOTE_FORM") row = await prisma.quoteLead.findUnique({ where: { id: leadId }, ...sel });
  else if (leadType === "AD_LEAD") row = await prisma.adLead.findUnique({ where: { id: leadId }, ...sel });
  else if (leadType === "OUT_OF_AREA") row = await prisma.outOfAreaLead.findUnique({ where: { id: leadId }, ...sel });
  else if (leadType === "COMMERCIAL") row = await prisma.commercialLead.findUnique({ where: { id: leadId }, ...sel });
  return row?.archived ?? false;
}
