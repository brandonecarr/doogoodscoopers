import prisma from "@/lib/prisma";
import { syncContactToQuo } from "@/lib/quo";
import { findProspectLeadsByPhone, consolidateByPhone } from "@/lib/lead-duplicates";

// Shared lead-capture logic, factored out of /api/save-quote-lead so the public
// quote form AND the funnel platform create leads identically (one person = one
// lead, dedupe/consolidate by phone, Instagram attribution, Quo contact sync).

export interface QuoteLeadInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone: string;
  address?: string | null;
  city?: string | null;
  zipCode: string;
  numberOfDogs?: string | null;
  frequency?: string | null;
  lastCleaned?: string | null;
  gateLocation?: string | null;
  gateCode?: string | null;
  lastStep?: string;
  dogsInfo?: unknown;
  igTracking?: string | null;
  sourceLabel?: string; // Quo source; defaults to "DooGoodScoopers Quote"
}

/** Create or update a QuoteLead (marketing pipeline → drips → Quo). Returns the id. */
export async function captureQuoteLead(data: QuoteLeadInput): Promise<string> {
  const prospects = await findProspectLeadsByPhone(data.phone);
  const existingQuote = prospects
    .filter((p) => p.type === "quote")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const quoteFields = {
    firstName: data.firstName,
    lastName: data.lastName ?? undefined,
    email: data.email ?? undefined,
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    numberOfDogs: data.numberOfDogs ?? undefined,
    frequency: data.frequency ?? undefined,
    lastCleaned: data.lastCleaned ?? undefined,
    gateLocation: data.gateLocation ?? undefined,
    gateCode: data.gateCode ?? undefined,
    lastStep: data.lastStep ?? "Funnel",
    dogsInfo: data.dogsInfo ? JSON.parse(JSON.stringify(data.dogsInfo)) : undefined,
  };

  let leadId: string;
  if (existingQuote) {
    await prisma.quoteLead.update({ where: { id: existingQuote.id }, data: quoteFields });
    leadId = existingQuote.id;
  } else {
    const lead = await prisma.quoteLead.create({
      data: { ...quoteFields, phone: data.phone, zipCode: data.zipCode },
    });
    leadId = lead.id;
  }

  if (prospects.length > (existingQuote ? 1 : 0)) {
    try {
      const survivor = await consolidateByPhone(data.phone);
      if (survivor) leadId = survivor.id;
    } catch (e) {
      console.error("[lead-capture] consolidation failed:", e);
    }
  }

  if (data.igTracking) {
    try {
      const igLead = await prisma.instagramLead.findUnique({ where: { trackingCode: data.igTracking } });
      if (igLead) {
        await prisma.quoteLead.update({
          where: { id: leadId },
          data: { sourceChannel: "instagram", instagramLeadId: igLead.id },
        });
        await prisma.instagramLead.update({
          where: { id: igLead.id },
          data: {
            status: "CONVERTED",
            convertedQuoteLeadId: leadId,
            convertedAt: new Date(),
            firstName: igLead.firstName ?? data.firstName,
            lastName: igLead.lastName ?? data.lastName ?? null,
            email: igLead.email ?? data.email ?? null,
            phone: igLead.phone ?? data.phone,
            zipCode: igLead.zipCode ?? data.zipCode,
          },
        });
      }
    } catch (e) {
      console.error("[lead-capture] Instagram attribution failed:", e);
    }
  }

  syncContactToQuo({
    externalId: `quotelead:${leadId}`,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    source: data.sourceLabel ?? "DooGoodScoopers Quote",
  });

  return leadId;
}

export interface OutOfAreaInput {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone: string;
  zipCode: string;
}

/** Create a Prisma OutOfAreaLead (feeds the /admin Out of Area pipeline). */
export async function captureOutOfAreaLead(data: OutOfAreaInput): Promise<string> {
  const lead = await prisma.outOfAreaLead.create({
    data: {
      firstName: (data.firstName ?? "").trim(),
      lastName: (data.lastName ?? "").trim(),
      email: (data.email ?? "").trim(),
      phone: data.phone.trim(),
      zipCode: data.zipCode.trim(),
    },
  });
  syncContactToQuo({
    externalId: `outofarealead:${lead.id}`,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    source: "DooGoodScoopers Out of Area",
  });
  return lead.id;
}
