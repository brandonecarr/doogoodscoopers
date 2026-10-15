import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";
import { resumeLinkForLead, recoverySettings, wizardSubmissionFor, type ResumeChannel } from "@/lib/quote-recovery";
import { cityFromZip } from "@/lib/geo/zipCity";
import { privateName } from "@/lib/tv-connector";

/**
 * Personalization tokens available to SMS templates ({{firstName}}, {{zipCode}},
 * {{numberOfDogs}}, ...). Rendered by renderTemplate() at send time against the
 * lead's own record, so drips/blasts/manual sends all resolve the same way.
 *
 * Data caveats (why a token can come back empty):
 *   - numberOfDogs only exists on quote-form leads. Meta/ad, out-of-area,
 *     commercial and career leads have no such field → always "".
 *   - zipCode is required on quote leads but Sweep&Go's free-quote feed does not
 *     include it, so API-synced quote leads have a blank zip. Ad leads only carry
 *     a zip when the ad form collected one.
 *
 * We ALWAYS return every key (empty string when unknown) so an unresolved
 * "{{token}}" never leaks into an outgoing message.
 */
export interface LeadVars {
  firstName: string;
  lastName: string;
  name: string;
  zipCode: string;
  /** The lead's city: what they typed, else looked up from the ZIP (offline dataset). Empty when unknown. */
  city: string;
  /** Bare count, e.g. "2". Empty when unknown. */
  numberOfDogs: string;
  /** Count + correctly pluralized noun, e.g. "1 dog" / "2 dogs". Empty when unknown. */
  dogs: string;
  /** Just the pluralized noun, "dog" / "dogs". Empty when unknown. */
  dogWord: string;
  // {{reviewLink}} (Google review link, for review drips), {{resumeLink}} (the
  // lead's pick-up-where-you-left-off link on the website) and {{coupon}} (the
  // quote-recovery coupon) are also provided at runtime via the index signature
  // below — see getLeadPersonalization. Quote leads also get {{frequency}} ("Weekly"),
  // {{monthlyRate}} ("$89", from the quote the wizard stored) and {{resumeCode}}.
  // {{unsubscribeUrl}} is filled per recipient by the email sender.
  [key: string]: string;
}

export const EMPTY_LEAD_VARS: LeadVars = {
  firstName: "",
  lastName: "",
  name: "",
  zipCode: "",
  city: "",
  numberOfDogs: "",
  dogs: "",
  dogWord: "",
  reviewLink: "",
  resumeLink: "",
  coupon: "",
  frequency: "",
  monthlyRate: "",
  resumeCode: "",
  unsubscribeUrl: "",
  reviewCount: "",
  review1Text: "",
  review1Name: "",
  review1City: "",
  review2Text: "",
  review2Name: "",
  review2City: "",
};

/** Cut a review to about `max` characters at a word boundary, so a card stays short. */
function shortQuote(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[,;:\s]+$/, "") + "…";
}

/**
 * Social-proof tokens: the Google review count and two five-star reviews with text,
 * newest first, preferring reviewers from the lead's own city. Cities come from the
 * matching Sweep&Go customer; a reviewer we can't place is labeled by the lead's area.
 */
async function reviewTokens(leadCity: string): Promise<Pick<LeadVars, "reviewCount" | "review1Text" | "review1Name" | "review1City" | "review2Text" | "review2Name" | "review2City">> {
  const out = { reviewCount: "", review1Text: "", review1Name: "", review1City: "", review2Text: "", review2Name: "", review2City: "" };
  try {
    const [countRow, reviews] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: "google.bp.reviewCount" } }),
      prisma.review.findMany({
        where: { status: "COMPLETED", rating: 5, reviewText: { not: null } },
        orderBy: { reviewedAt: "desc" },
        take: 40,
        select: { customerName: true, reviewText: true, sngCustomerId: true },
      }),
    ]);
    const total = Number(countRow?.value);
    out.reviewCount = Number.isFinite(total) && total > 0 ? String(total) : String(await prisma.review.count({ where: { status: "COMPLETED", platform: "google" } }));

    const usable = reviews.filter((r) => (r.reviewText || "").trim().length >= 20);
    if (usable.length === 0) return out;
    // City lookup: the linked Sweep&Go customer, else a customer with the same name.
    const names = usable.map((r) => r.customerName.trim().split(/\s+/)).filter((p) => p.length > 1);
    const customers = await prisma.sweepandgoCustomer.findMany({
      where: { OR: [
        { id: { in: usable.map((r) => r.sngCustomerId).filter((x): x is string => !!x) } },
        { lastName: { in: names.map((p) => p[p.length - 1]), mode: "insensitive" } },
      ] },
      select: { id: true, firstName: true, lastName: true, city: true, zipCode: true },
    });
    const cityFor = (r: { customerName: string; sngCustomerId: string | null }): string => {
      const parts = r.customerName.trim().split(/\s+/);
      const hit = customers.find((c) => c.id === r.sngCustomerId)
        ?? customers.find((c) => parts.length > 1 && c.firstName?.toLowerCase() === parts[0].toLowerCase() && c.lastName?.toLowerCase() === parts[parts.length - 1].toLowerCase());
      // The customer's own city, else the city of their ZIP; never the lead's city.
      return (hit?.city || "").trim() || cityFromZip(hit?.zipCode) || "";
    };
    const placed = usable.map((r) => ({ ...r, city: cityFor(r) }));
    const lc = leadCity.trim().toLowerCase();
    const picked = [
      ...placed.filter((r) => lc && r.city.toLowerCase() === lc),
      ...placed.filter((r) => !(lc && r.city.toLowerCase() === lc)),
    ].slice(0, 2);
    picked.forEach((r, i) => {
      const parts = r.customerName.trim().split(/\s+/);
      const key = i === 0 ? "review1" : "review2";
      out[`${key}Text` as "review1Text"] = shortQuote(r.reviewText || "");
      out[`${key}Name` as "review1Name"] = privateName(parts[0], parts.length > 1 ? parts[parts.length - 1] : null, "A customer");
      out[`${key}City` as "review1City"] = r.city || "Inland Empire";
    });
  } catch (e) {
    console.error("[personalization] review tokens failed:", e);
  }
  return out;
}

/** Short cleanup-frequency labels, as the quote cards show them. */
const SHORT_FREQUENCY: Record<string, string> = {
  once_a_week: "Weekly", weekly: "Weekly", two_times_a_week: "2x weekly", bi_weekly: "Bi-weekly", biweekly: "Bi-weekly", "bi-weekly": "Bi-weekly",
  once_a_month: "Monthly", monthly: "Monthly", one_time: "One-time", onetime: "One-time", "one time": "One-time",
};
export function frequencyLabel(raw: string | null | undefined): string {
  const f = (raw || "").trim();
  if (!f) return "";
  return SHORT_FREQUENCY[f.toLowerCase()] || SHORT_FREQUENCY[f.toLowerCase().replace(/[\s-]+/g, "_")] || f.replace(/_/g, " ");
}
/** "$89" from the wizard's stored quote ("$89/monthly + Initial Cleaning…" or "$99* For Your One-Time Cleanup"). */
export function monthlyRateFrom(quotedPrice: string | null | undefined): string {
  const qp = quotedPrice || "";
  const monthly = qp.match(/^\$(\d+(?:\.\d+)?)\/month/);
  if (monthly) return "$" + monthly[1];
  const oneTime = /one-time/i.test(qp) ? qp.match(/^\$(\d+)/)?.[1] : null;
  return oneTime ? "$" + oneTime : "";
}

/**
 * First name ONLY — the first whitespace-delimited token. Strips middle initials
 * and any last name accidentally typed into the first-name field, so texts read
 * "Hi Robert" not "Hi Robert P" or "Hi Robert P Zeigler".
 */
export function firstNameOf(full: string): string {
  return (full || "").trim().split(/\s+/)[0] || "";
}

/**
 * Turn a raw dog-count value (free text like "2", "2 dogs", "3+") into the set
 * of dog tokens, handling singular/plural. Unknown/blank → all empty so the copy
 * degrades cleanly instead of printing "your  dogs".
 */
function dogTokens(raw: string | null | undefined): Pick<LeadVars, "numberOfDogs" | "dogs" | "dogWord"> {
  const s = (raw || "").trim();
  if (!s) return { numberOfDogs: "", dogs: "", dogWord: "" };
  const m = s.match(/\d+/);
  if (m) {
    const n = parseInt(m[0], 10);
    const word = n === 1 ? "dog" : "dogs";
    return { numberOfDogs: String(n), dogs: `${n} ${word}`, dogWord: word };
  }
  // Non-numeric but present (e.g. "several") — assume plural.
  return { numberOfDogs: s, dogs: `${s} dogs`, dogWord: "dogs" };
}

/** The city to print: the stored one when present, else derived from the ZIP. */
function cityToken(city: string | null | undefined, zip: string | null | undefined): string {
  const c = (city || "").trim();
  return c || cityFromZip(zip) || "";
}

/** Best-effort dog count from an ad lead's captured form fields (customFields JSON). */
function adDogCount(customFields: unknown): string {
  if (!customFields || typeof customFields !== "object") return "";
  for (const [key, value] of Object.entries(customFields as Record<string, unknown>)) {
    if (/dog/i.test(key) && value != null && value !== "") return String(value);
  }
  return "";
}

/** The org's Google "leave a review" link (from settings). Empty if unset. */
async function getReviewLink(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: "reviews.google.writeUrl" } });
  return row?.value?.trim() || "";
}

/**
 * Load the personalization tokens for a single lead, including {{reviewLink}}
 * for review drips. Missing lead → all blank.
 */
export async function getLeadPersonalization(leadType: LeadSource, leadId: string, opts: { channel?: ResumeChannel } = {}): Promise<LeadVars> {
  const [base, reviewLink, recovery] = await Promise.all([baseLeadVars(leadType, leadId), getReviewLink(), recoverySettings()]);
  base.reviewLink = reviewLink;
  base.coupon = recovery.coupon;
  Object.assign(base, await reviewTokens(base.city));
  // Only quote leads have a Sweep&Go quote to resume; everyone else gets the plain quote page.
  base.resumeLink = leadType === "QUOTE_FORM" ? await resumeLinkForLead(leadId, opts.channel, recovery) : recovery.quoteUrl;
  if (leadType === "QUOTE_FORM") {
    // resumeLinkForLead just made sure the code exists; the monthly rate comes from the wizard's stored quote.
    const l = await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { id: true, phone: true, resumeCode: true, frequency: true } });
    if (l) {
      base.resumeCode = l.resumeCode || "";
      base.frequency = frequencyLabel(l.frequency);
      const sub = await wizardSubmissionFor(l).catch(() => null);
      base.monthlyRate = monthlyRateFrom(sub?.quotedPrice);
    }
  }
  return base;
}

async function baseLeadVars(leadType: LeadSource, leadId: string): Promise<LeadVars> {
  switch (leadType) {
    case "QUOTE_FORM": {
      const l = await prisma.quoteLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, zipCode: true, city: true, numberOfDogs: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return {
        firstName: firstNameOf(l.firstName || name),
        lastName: l.lastName || "",
        name,
        zipCode: l.zipCode || "",
        city: cityToken(l.city, l.zipCode),
        ...dogTokens(l.numberOfDogs),
      };
    }
    case "AD_LEAD": {
      const l = await prisma.adLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, fullName: true, zipCode: true, city: true, customFields: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" ");
      return {
        firstName: firstNameOf(l.firstName || name),
        lastName: l.lastName || "",
        name,
        zipCode: l.zipCode || "",
        city: cityToken(l.city, l.zipCode),
        ...dogTokens(adDogCount(l.customFields)),
      };
    }
    case "OUT_OF_AREA": {
      const l = await prisma.outOfAreaLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, zipCode: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: firstNameOf(l.firstName || name), lastName: l.lastName || "", name, zipCode: l.zipCode || "", city: cityToken(null, l.zipCode), ...dogTokens("") };
    }
    case "COMMERCIAL": {
      const l = await prisma.commercialLead.findUnique({
        where: { id: leadId },
        select: { contactName: true, zipCode: true, city: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      return { firstName: firstNameOf(l.contactName || ""), lastName: "", name: l.contactName || "", zipCode: l.zipCode || "", city: cityToken(l.city, l.zipCode), ...dogTokens("") };
    }
    case "CAREERS": {
      const l = await prisma.careerApplication.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: firstNameOf(l.firstName || name), lastName: l.lastName || "", name, zipCode: "", city: "", ...dogTokens("") };
    }
    case "CUSTOMER": {
      const l = await prisma.sweepandgoCustomer.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, zipCode: true, city: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: firstNameOf(l.firstName || name), lastName: l.lastName || "", name, zipCode: l.zipCode || "", city: cityToken(l.city, l.zipCode), ...dogTokens("") };
    }
  }
  return { ...EMPTY_LEAD_VARS };
}
