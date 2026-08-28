import prisma from "@/lib/prisma";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { loadSendWindow, clampToSendWindow } from "@/lib/send-window";
import { LeadStatus, type LeadSource } from "@prisma/client";

/**
 * Drip-campaign enrollment. A drip auto-enrolls NEW leads (created after the
 * campaign was created) whose type matches the campaign trigger. Excludes leads
 * that are archived, opted out, or already enrolled.
 */

/**
 * `lastStep` value on a QuoteLead created by AI call notes from a phone call.
 * These leads are excluded from every drip trigger — see findDripCandidates.
 */
export const PHONE_CALL_STEP = "Phone Call";

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
    const stepFilter =
      types.has("quote") && types.has("manual")
        ? {}
        : types.has("manual")
          ? { lastStep: "Manual Entry" }
          : { NOT: { lastStep: "Manual Entry" } };

    const rows = await prisma.quoteLead.findMany({
      where: {
        ...base,
        // Phone-call leads live in QuoteLead but never ran a quote — they just
        // called. Auto-enrolling them in a quote drip sends copy that is plainly
        // wrong ("I saw that you ran a quote on our website"). They are never
        // auto-enrolled in any drip; add them to a campaign by hand instead.
        AND: [stepFilter, { NOT: { lastStep: PHONE_CALL_STEP } }],
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

/**
 * Move a lead from NEW → CONTACTED after the drip first reaches them. Gated on
 * status:NEW so it only ever makes that one transition — a status you've set
 * manually (No Answer, Converted, etc.) is never overwritten. No-op for
 * CUSTOMER (no lead status).
 */
export async function markLeadContactedIfNew(leadType: LeadSource, leadId: string): Promise<void> {
  const where = { id: leadId, status: LeadStatus.NEW };
  const data = { status: LeadStatus.CONTACTED };
  if (leadType === "QUOTE_FORM") await prisma.quoteLead.updateMany({ where, data });
  else if (leadType === "AD_LEAD") await prisma.adLead.updateMany({ where, data });
  else if (leadType === "OUT_OF_AREA") await prisma.outOfAreaLead.updateMany({ where, data });
  else if (leadType === "COMMERCIAL") await prisma.commercialLead.updateMany({ where, data });
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

const MINUTE_MS = 60 * 1000;

/**
 * Enroll a lead into every active "returning lead" drip the instant they
 * re-engage, with its OWN message sequence (different from a cold lead).
 *
 * The source is selectable, because "came back through the quote form" and
 * "re-submitted a Meta ad" deserve different copy:
 *   "returning-meta"  → only a returning AdLead
 *   "returning-quote" → only a returning QuoteLead
 *   both selected     → both
 *   "returning"       → legacy token, still honoured, means BOTH
 *
 * Why this can't ride the normal auto-enroll: consolidation backdates a
 * returning lead's `createdAt` to first contact, so `findDripCandidates`
 * (which keys on `createdAt > campaign.createdAt`) never sees them. So we enroll
 * here, at the moment of re-engagement (called from `recordReengagement`).
 *
 * Fresh enroll if not already a recipient; if they previously COMPLETED/STOPPED
 * the sequence, restart it (they came back again). If they're mid-sequence
 * (ACTIVE), leave them be. Best-effort — never throws into lead capture.
 * Returns how many campaigns the lead was (re-)enrolled into.
 */
export async function enrollReturningLead(leadType: LeadSource, leadId: string): Promise<number> {
  if (leadType !== "AD_LEAD" && leadType !== "QUOTE_FORM") return 0;

  const campaigns = await prisma.campaign.findMany({
    where: { type: "DRIP", active: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  // Match only campaigns that asked for THIS lead's source.
  const wanted = leadType === "AD_LEAD" ? "returning-meta" : "returning-quote";
  const returning = campaigns.filter((c) => {
    const f = (c.audienceFilter || {}) as { leadTypes?: string[] };
    const types = f.leadTypes || [];
    return (types.includes(wanted) || types.includes("returning")) && c.steps.length > 0;
  });
  if (returning.length === 0) return 0;

  // Contact info (and skip archived leads).
  let phone = "";
  let name: string | null = null;
  if (leadType === "AD_LEAD") {
    const l = await prisma.adLead.findUnique({ where: { id: leadId }, select: { phone: true, firstName: true, lastName: true, fullName: true, archived: true } });
    if (!l || l.archived) return 0;
    phone = l.phone || "";
    name = l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" ") || null;
  } else {
    const l = await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { phone: true, firstName: true, lastName: true, archived: true } });
    if (!l || l.archived) return 0;
    phone = l.phone || "";
    name = [l.firstName, l.lastName].filter(Boolean).join(" ") || null;
  }

  // Opt-out guard (mirrors findDripCandidates).
  if (phone) {
    const optedOut = await optedOutKeys();
    const k = optOutKey(phone);
    if (k && optedOut.has(k)) return 0;
  }

  const window = await loadSendWindow();
  let n = 0;
  for (const c of returning) {
    const firstAt = clampToSendWindow(new Date(Date.now() + (c.steps[0].delayMinutes || 0) * MINUTE_MS), window);
    const existing = await prisma.campaignRecipient.findUnique({
      where: { campaignId_leadType_leadId: { campaignId: c.id, leadType, leadId } },
      select: { id: true, status: true },
    });
    try {
      if (!existing) {
        await prisma.campaignRecipient.create({
          data: { campaignId: c.id, leadType, leadId, phone, name, status: "ACTIVE", currentStep: 0, nextSendAt: firstAt },
        });
        n++;
      } else if (existing.status === "COMPLETED" || existing.status === "STOPPED") {
        await prisma.campaignRecipient.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", currentStep: 0, nextSendAt: firstAt, error: null, sentAt: null, phone },
        });
        n++;
      }
      // status ACTIVE → already mid-sequence, leave it.
    } catch {
      // unique race / transient — skip.
    }
  }
  return n;
}
