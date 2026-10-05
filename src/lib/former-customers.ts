import { distance } from "zipcodes";
import prisma from "@/lib/prisma";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { estimateMonthlyRevenue } from "@/lib/plan-pricing";
import { normalizeZip5 } from "@/lib/geo/zipCity";

// Former customers as a campaign audience (win-back drips). Customers opt in to SMS
// when they sign up, so everyone with a phone can be texted unless they explicitly
// declined (smsConsent=false) or texted STOP.

const FAR_MILES = 20; // farther than this from every current customer = likely outside the area

export interface FormerCustomer {
  id: string; name: string; city: string | null; zip: string | null;
  email: string | null; phone: string | null; removedAt: Date | null;
  smsDeclined: boolean; unsubscribed: boolean; optedOut: boolean;
  milesToNearestCustomer: number | null; farAway: boolean;
  emailEligible: boolean; smsEligible: boolean;
}

/** Every former customer, with who can get email/text and who looks out of area. */
export async function formerCustomers(): Promise<FormerCustomer[]> {
  const [former, activeZips, unsub, optedOut] = await Promise.all([
    prisma.sweepandgoCustomer.findMany({
      where: { active: false },
      select: { id: true, firstName: true, lastName: true, city: true, zipCode: true, email: true, cellPhone: true, homePhone: true, smsConsent: true, removedAt: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.sweepandgoCustomer.findMany({ where: { active: true, zipCode: { not: null } }, select: { zipCode: true }, distinct: ["zipCode"] }),
    unsubscribedSet(),
    optedOutKeys(),
  ]);
  const serviceZips = activeZips.map((z) => normalizeZip5(z.zipCode)).filter((z): z is string => !!z);
  return former.map((c) => {
    const zip = normalizeZip5(c.zipCode);
    let miles: number | null = null;
    if (zip) for (const z of serviceZips) {
      const d = z === zip ? 0 : distance(zip, z);
      if (d != null && (miles == null || d < miles)) miles = d;
    }
    const phone = c.cellPhone || c.homePhone || null;
    const unsubscribed = !!c.email && unsub.has(normalizeEmail(c.email));
    const optedOutPhone = !!phone && optedOut.has(optOutKey(phone) ?? "");
    const smsDeclined = c.smsConsent === false;
    return {
      id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "(no name)", city: c.city, zip,
      email: c.email, phone, removedAt: c.removedAt, smsDeclined, unsubscribed, optedOut: optedOutPhone,
      milesToNearestCustomer: miles == null ? null : Math.round(miles), farAway: miles != null && miles > FAR_MILES,
      emailEligible: !!c.email && !unsubscribed,
      smsEligible: !smsDeclined && !!phone && !optedOutPhone,
    };
  });
}

export interface WinbackResult { id: string; name: string; city: string | null; cameBackAt: string | null; monthlyRevenue: number }

/** Who in a win-back campaign is an active customer again, and what they're worth per month. */
export async function winbackResults(campaignId: string, since: Date): Promise<WinbackResult[]> {
  const recips = await prisma.campaignRecipient.findMany({ where: { campaignId, leadType: "CUSTOMER" }, select: { leadId: true } });
  if (recips.length === 0) return [];
  const back = await prisma.sweepandgoCustomer.findMany({
    where: { id: { in: recips.map((r) => r.leadId) }, active: true },
    select: { id: true, sngId: true, firstName: true, lastName: true, city: true, subscriptionNames: true },
  });
  if (back.length === 0) return [];
  // The customer sync logs a comeback as "sng-return:<sngId>:<date>".
  const events = await prisma.subscriptionEvent.findMany({
    where: { kind: "SIGNUP", occurredAt: { gte: since }, dedupeKey: { startsWith: "sng-return:" } },
    select: { dedupeKey: true, occurredAt: true },
  });
  const returnedAt = new Map<string, Date>();
  for (const e of events) {
    const sng = e.dedupeKey.split(":")[1];
    if (!returnedAt.has(sng) || e.occurredAt < returnedAt.get(sng)!) returnedAt.set(sng, e.occurredAt);
  }
  return back.map((c) => ({
    id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), city: c.city,
    cameBackAt: returnedAt.get(c.sngId)?.toISOString() ?? null,
    monthlyRevenue: estimateMonthlyRevenue(c.subscriptionNames),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
