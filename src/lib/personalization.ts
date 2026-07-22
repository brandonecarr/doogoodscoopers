import prisma from "@/lib/prisma";
import type { LeadSource } from "@prisma/client";

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
  /** Bare count, e.g. "2". Empty when unknown. */
  numberOfDogs: string;
  /** Count + correctly pluralized noun, e.g. "1 dog" / "2 dogs". Empty when unknown. */
  dogs: string;
  /** Just the pluralized noun, "dog" / "dogs". Empty when unknown. */
  dogWord: string;
  [key: string]: string;
}

export const EMPTY_LEAD_VARS: LeadVars = {
  firstName: "",
  lastName: "",
  name: "",
  zipCode: "",
  numberOfDogs: "",
  dogs: "",
  dogWord: "",
};

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] || "";
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

/** Best-effort dog count from an ad lead's captured form fields (customFields JSON). */
function adDogCount(customFields: unknown): string {
  if (!customFields || typeof customFields !== "object") return "";
  for (const [key, value] of Object.entries(customFields as Record<string, unknown>)) {
    if (/dog/i.test(key) && value != null && value !== "") return String(value);
  }
  return "";
}

/** Load the personalization tokens for a single lead. Missing lead → all blank. */
export async function getLeadPersonalization(leadType: LeadSource, leadId: string): Promise<LeadVars> {
  switch (leadType) {
    case "QUOTE_FORM": {
      const l = await prisma.quoteLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, zipCode: true, numberOfDogs: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return {
        firstName: l.firstName || firstNameOf(name),
        lastName: l.lastName || "",
        name,
        zipCode: l.zipCode || "",
        ...dogTokens(l.numberOfDogs),
      };
    }
    case "AD_LEAD": {
      const l = await prisma.adLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, fullName: true, zipCode: true, customFields: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" ");
      return {
        firstName: l.firstName || firstNameOf(name),
        lastName: l.lastName || "",
        name,
        zipCode: l.zipCode || "",
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
      return { firstName: l.firstName || firstNameOf(name), lastName: l.lastName || "", name, zipCode: l.zipCode || "", ...dogTokens("") };
    }
    case "COMMERCIAL": {
      const l = await prisma.commercialLead.findUnique({
        where: { id: leadId },
        select: { contactName: true, zipCode: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      return { firstName: firstNameOf(l.contactName || ""), lastName: "", name: l.contactName || "", zipCode: l.zipCode || "", ...dogTokens("") };
    }
    case "CAREERS": {
      const l = await prisma.careerApplication.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: l.firstName || firstNameOf(name), lastName: l.lastName || "", name, zipCode: "", ...dogTokens("") };
    }
  }
  return { ...EMPTY_LEAD_VARS };
}
