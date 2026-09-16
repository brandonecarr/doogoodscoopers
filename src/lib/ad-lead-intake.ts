import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { syncContactToQuo } from "@/lib/quo";
import { sendAdminPush } from "@/lib/web-push";
import { consolidateByPhone, recordReengagement } from "@/lib/lead-duplicates";

/**
 * One place to turn an inbound Meta lead into an AdLead — used by BOTH the Zapier
 * webhook and the direct Lead Ads webhook, so they behave identically: create the
 * lead, fold it into an existing quote/ad lead by phone, surface returning leads,
 * sync to Quo, and push a notification. metaLeadId makes redelivery idempotent.
 */
export interface AdLeadInput {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  campaignName: string | null;
  adSetName: string | null;
  adName: string | null;
  formName: string | null;
  customFields: Record<string, unknown>;
  rawPayload: unknown;
  metaLeadId?: string | null;
  sourceLabel: string; // "Zapier" | "Lead Ads webhook", for logs
}

export interface AdLeadResult { finalType: "quote" | "adlead"; finalId: string; isReturning: boolean; duplicate?: boolean }

export async function createAdLeadFromMeta(input: AdLeadInput): Promise<AdLeadResult> {
  // Idempotency: the same leadgen id never creates a second lead.
  if (input.metaLeadId) {
    const existing = await prisma.adLead.findUnique({ where: { metaLeadId: input.metaLeadId }, select: { id: true } });
    if (existing) return { finalType: "adlead", finalId: existing.id, isReturning: false, duplicate: true };
  }

  // Normalize the dog count into a predictable key (any field mentioning "dog").
  const customFields = { ...input.customFields };
  if (!("numberOfDogs" in customFields)) {
    for (const [k, v] of Object.entries(customFields)) {
      if (/dog/i.test(k) && v != null && String(v).trim() !== "") { customFields.numberOfDogs = String(v).trim(); break; }
    }
  }

  const lead = await prisma.adLead.create({
    data: {
      firstName: input.firstName, lastName: input.lastName, fullName: input.fullName,
      email: input.email, phone: input.phone, city: input.city, state: input.state, zipCode: input.zipCode,
      adSource: "meta", campaignName: input.campaignName, adSetName: input.adSetName, adName: input.adName, formName: input.formName,
      metaLeadId: input.metaLeadId ?? null,
      customFields: Object.keys(customFields).length ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
      rawPayload: input.rawPayload as Prisma.InputJsonValue,
    },
  });

  let finalType: "quote" | "adlead" = "adlead";
  let finalId = lead.id;
  let isReturning = false;
  try {
    const survivor = await consolidateByPhone(input.phone);
    if (survivor) {
      finalType = survivor.type; finalId = survivor.id;
      if (survivor.isReturning) {
        isReturning = true;
        await recordReengagement(survivor, { message: `🔁 Returning lead — re-submitted the ad form${input.campaignName ? ` (${input.campaignName})` : ""}.` });
      }
    }
  } catch (e) { console.error(`[${input.sourceLabel}] consolidation failed:`, e); }

  syncContactToQuo({
    externalId: `${finalType === "quote" ? "quotelead" : "adlead"}:${finalId}`,
    firstName: lead.firstName || lead.fullName || "Ad Lead",
    lastName: lead.lastName, email: lead.email, phone: lead.phone, source: "DooGoodScoopers Ad",
  });

  const merged = finalType === "quote";
  sendAdminPush({
    title: isReturning ? "🔁 Returning lead re-submitted" : merged ? "📣 Ad Lead matched an existing quote" : "📣 New Ad Lead",
    body: `${input.fullName || input.phone || input.email || "Unknown"} — ${input.campaignName || "Meta Ad"}`,
    url: `/admin/${finalType === "quote" ? "quote-leads" : "ad-leads"}/${finalId}`,
    tag: `ad-lead-${finalId}`,
  }).catch((err) => console.error(`[${input.sourceLabel}] Push notification failed:`, err));

  console.log(`[${input.sourceLabel}] lead ${finalType}:${finalId} — ${input.fullName || input.email || input.phone}`);
  return { finalType, finalId, isReturning };
}

/** Split a flat form payload / field map into the AdLeadInput shape (shared field aliases). */
export function mapFlatLead(payload: Record<string, unknown>, opts: { metaLeadId?: string | null; sourceLabel: string; extra?: Partial<AdLeadInput> }): AdLeadInput {
  const g = (...keys: string[]) => { for (const k of keys) { const v = payload[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); } return null; };
  let firstName = g("first_name", "firstName");
  let lastName = g("last_name", "lastName");
  let fullName = g("name", "full_name", "fullName");
  if (fullName && !firstName) { const p = fullName.split(/\s+/); firstName = p[0] || null; lastName = p.slice(1).join(" ") || null; }
  if (!fullName && (firstName || lastName)) fullName = [firstName, lastName].filter(Boolean).join(" ");
  const known = new Set(["name", "full_name", "fullName", "first_name", "firstName", "last_name", "lastName", "email", "phone", "phone_number", "city", "state", "zip_code", "zip", "postal_code", "street_address", "ad_id", "ad_name", "adset_id", "adset_name", "ad_set_name", "campaign_id", "campaign_name", "form_id", "form_name", "created_time", "platform", "leadgen_id"]);
  const customFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) if (!known.has(k) && v != null && v !== "") customFields[k] = v;
  return {
    firstName, lastName, fullName,
    email: g("email"), phone: g("phone", "phone_number"),
    city: g("city"), state: g("state"), zipCode: g("zip_code", "zip", "postal_code"),
    campaignName: g("campaign_name"), adSetName: g("adset_name", "ad_set_name"), adName: g("ad_name"), formName: g("form_name"),
    customFields, rawPayload: payload, metaLeadId: opts.metaLeadId ?? null, sourceLabel: opts.sourceLabel, ...(opts.extra || {}),
  };
}
