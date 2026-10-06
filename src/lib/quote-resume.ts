import crypto from "crypto";
import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

// "Pick up where you left off" links for campaign messages ({{resumeLink}}).
// The link opens the quote wizard with everything the lead already told us filled
// in. The token is signed so a link can't be forged or guessed; it carries no
// personal data itself (the wizard fetches that from /api/v2/quote-resume).

const SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "dgs-email-unsub";
// The quote wizard lives on the CRM app, not the WordPress marketing site.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.vercel.app";

/** Lead types whose answers can be carried into the quote wizard. */
const RESUMABLE: ReadonlySet<LeadSource> = new Set<LeadSource>(["QUOTE_FORM", "AD_LEAD"]);

const sign = (payload: string) => crypto.createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 20);

export function resumeToken(leadType: LeadSource, leadId: string): string {
  const payload = `${leadType}.${leadId}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyResumeToken(token: string): { leadType: LeadSource; leadId: string } | null {
  const [b, sig] = (token || "").split(".");
  if (!b || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(b, "base64url").toString("utf8"); } catch { return null; }
  if (sign(payload) !== sig) return null;
  const i = payload.indexOf(".");
  if (i < 0) return null;
  const leadType = payload.slice(0, i) as LeadSource;
  const leadId = payload.slice(i + 1);
  return RESUMABLE.has(leadType) && leadId ? { leadType, leadId } : null;
}

/** The link to put in a message. Leads we can't prefill still get the plain quote page. */
export function resumeLinkFor(leadType: LeadSource, leadId: string): string {
  return RESUMABLE.has(leadType) ? `${SITE}/quote?resume=${resumeToken(leadType, leadId)}` : `${SITE}/quote`;
}

export interface ResumePrefill {
  firstName: string; lastName: string; email: string; phone: string; zipCode: string;
  numberOfDogs: string; frequency: string; lastCleaned: string;
  address: string; city: string; gateLocation: string; gateCode: string;
}

/** What the lead already told us, for the wizard to fill in. Null if the lead is gone. */
export async function resumePrefill(leadType: LeadSource, leadId: string): Promise<ResumePrefill | null> {
  if (leadType === "QUOTE_FORM") {
    const l = await prisma.quoteLead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true, phone: true, zipCode: true, numberOfDogs: true, frequency: true, lastCleaned: true, address: true, city: true, gateLocation: true, gateCode: true, archived: true },
    });
    if (!l) return null;
    // Quote leads sometimes hold the full name in firstName.
    const parts = (l.firstName || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = l.lastName || parts.slice(1).join(" ");
    return {
      firstName, lastName, email: l.email || "", phone: l.phone || "", zipCode: l.zipCode || "",
      numberOfDogs: l.numberOfDogs || "", frequency: l.frequency || "", lastCleaned: l.lastCleaned || "",
      address: l.address || "", city: l.city || "", gateLocation: l.gateLocation || "", gateCode: l.gateCode || "",
    };
  }
  const l = await prisma.adLead.findUnique({
    where: { id: leadId },
    select: { firstName: true, lastName: true, fullName: true, email: true, phone: true, zipCode: true },
  });
  if (!l) return null;
  const parts = (l.fullName || "").trim().split(/\s+/);
  return {
    firstName: l.firstName || parts[0] || "", lastName: l.lastName || parts.slice(1).join(" "),
    email: l.email || "", phone: l.phone || "", zipCode: l.zipCode || "",
    numberOfDogs: "", frequency: "", lastCleaned: "", address: "", city: "", gateLocation: "", gateCode: "",
  };
}

/** Note on the lead that they opened the link (once per 6 hours, so refreshes don't pile up). */
export async function recordResumeOpened(leadType: LeadSource, leadId: string): Promise<void> {
  const message = "🔗 Opened their pick-up-where-you-left-off link.";
  try {
    const recent = await prisma.leadUpdate.findFirst({
      where: { leadType, leadId, message, createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
      select: { id: true },
    });
    if (recent) return;
    await prisma.leadUpdate.create({ data: { leadType, leadId, message, communicationType: "other", adminEmail: "system" } });
    if (leadType === "QUOTE_FORM") await prisma.quoteLead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
  } catch (e) {
    console.error("[quote-resume] note failed:", e);
  }
}
