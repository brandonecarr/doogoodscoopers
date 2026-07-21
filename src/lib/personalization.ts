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
  numberOfDogs: string;
  [key: string]: string;
}

export const EMPTY_LEAD_VARS: LeadVars = {
  firstName: "",
  lastName: "",
  name: "",
  zipCode: "",
  numberOfDogs: "",
};

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] || "";
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
        numberOfDogs: l.numberOfDogs || "",
      };
    }
    case "AD_LEAD": {
      const l = await prisma.adLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, fullName: true, zipCode: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" ");
      return {
        firstName: l.firstName || firstNameOf(name),
        lastName: l.lastName || "",
        name,
        zipCode: l.zipCode || "",
        numberOfDogs: "",
      };
    }
    case "OUT_OF_AREA": {
      const l = await prisma.outOfAreaLead.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true, zipCode: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: l.firstName || firstNameOf(name), lastName: l.lastName || "", name, zipCode: l.zipCode || "", numberOfDogs: "" };
    }
    case "COMMERCIAL": {
      const l = await prisma.commercialLead.findUnique({
        where: { id: leadId },
        select: { contactName: true, zipCode: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      return { firstName: firstNameOf(l.contactName || ""), lastName: "", name: l.contactName || "", zipCode: l.zipCode || "", numberOfDogs: "" };
    }
    case "CAREERS": {
      const l = await prisma.careerApplication.findUnique({
        where: { id: leadId },
        select: { firstName: true, lastName: true },
      });
      if (!l) return { ...EMPTY_LEAD_VARS };
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
      return { firstName: l.firstName || firstNameOf(name), lastName: l.lastName || "", name, zipCode: "", numberOfDogs: "" };
    }
  }
  return { ...EMPTY_LEAD_VARS };
}
