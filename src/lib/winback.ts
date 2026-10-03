import { distance } from "zipcodes";
import prisma from "@/lib/prisma";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";
import { optedOutKeys, optOutKey } from "@/lib/sms-optout";
import { estimateMonthlyRevenue } from "@/lib/plan-pricing";
import { normalizeZip5 } from "@/lib/geo/zipCity";
import { WINBACK_FROM, fmtDeadline, winbackMessages } from "@/lib/winback-messages";

// ── Win-back campaign ─────────────────────────────────────────────────────────
// One-time sequence to former customers: 3 emails + 2 texts, 25% off the first month,
// with a deadline. Customers opt in to SMS when they sign up, so everyone with a phone is
// texted unless they explicitly declined (smsConsent=false) or texted STOP. Built on
// the existing engines: an EmailAutomation (process-email-automations) and an SMS DRIP
// Campaign (process-drips) with audience "former_customers". Recipients are enrolled
// once at launch (a snapshot); both engines stop a person as soon as their own customer
// record turns active again (they came back), on unsubscribe/STOP, or (texts) on reply.

const SETTING_KEY = "winback.current";
const FAR_MILES = 20; // farther than this from every current customer = likely outside the area
const DAY_MIN = 24 * 60;
export { WINBACK_CODE } from "@/lib/winback-messages";

export interface WinbackConfig {
  automationId: string;
  campaignId: string;
  launchedAt: string;
  startAt: string;
  deadline: string; // YYYY-MM-DD
  signupLink: string;
}

export interface WinbackCandidate {
  id: string; name: string; city: string | null; zip: string | null;
  email: string | null; phone: string | null;
  smsDeclined: boolean; unsubscribed: boolean; optedOut: boolean;
  milesToNearestCustomer: number | null; farAway: boolean;
  emailEligible: boolean; smsEligible: boolean; defaultInclude: boolean;
}

/** Every former customer, with who can get email/text and who looks out of area. */
export async function winbackCandidates(): Promise<WinbackCandidate[]> {
  const [former, activeZips, unsub, optedOut] = await Promise.all([
    prisma.sweepandgoCustomer.findMany({
      where: { active: false },
      select: { id: true, firstName: true, lastName: true, city: true, zipCode: true, email: true, cellPhone: true, homePhone: true, smsConsent: true },
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
    const emailEligible = !!c.email && !unsubscribed;
    // Signing up opts a customer in to SMS; only an explicit "no" (false) or a STOP excludes them.
    const smsDeclined = c.smsConsent === false;
    const smsEligible = !smsDeclined && !!phone && !optedOutPhone;
    const farAway = miles != null && miles > FAR_MILES;
    return {
      id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "(no name)", city: c.city, zip,
      email: c.email, phone, smsDeclined, unsubscribed, optedOut: optedOutPhone,
      milesToNearestCustomer: miles == null ? null : Math.round(miles), farAway,
      emailEligible, smsEligible, defaultInclude: (emailEligible || smsEligible) && !farAway,
    };
  });
}

export async function getWinbackConfig(): Promise<WinbackConfig | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  try { return row ? (JSON.parse(row.value) as WinbackConfig) : null; } catch { return null; }
}

/** Create both sequences and enroll the chosen former customers. One win-back at a time. */
export async function launchWinback(input: { startAt: Date; deadline: string; signupLink: string; includeIds: string[]; adminEmail: string }) {
  const existing = await getWinbackConfig();
  if (existing) {
    const camp = await prisma.campaign.findUnique({ where: { id: existing.campaignId }, select: { active: true } });
    const auto = await prisma.emailAutomation.findUnique({ where: { id: existing.automationId }, select: { active: true } });
    if (camp?.active || auto?.active) throw new Error("A win-back campaign is already running. Stop it before launching another.");
  }
  const msgs = winbackMessages(input.deadline, input.signupLink);
  const chosen = new Set(input.includeIds);
  const people = (await winbackCandidates()).filter((c) => chosen.has(c.id));
  const label = fmtDeadline(input.deadline, "short");

  const { automationId, campaignId, emailEnrolled, smsEnrolled } = await prisma.$transaction(async (tx) => {
    const automation = await tx.emailAutomation.create({
      data: { name: `Win-back: 25% off first month (through ${label})`, trigger: { types: [] }, active: true, fromName: WINBACK_FROM, adminEmail: input.adminEmail },
    });
    let prevDay = 0;
    await tx.emailAutomationStep.createMany({
      data: msgs.emails.map((e, i) => {
        const delayMinutes = (e.day - prevDay) * DAY_MIN;
        prevDay = e.day;
        return { automationId: automation.id, stepOrder: i, subject: e.subject, html: e.html, delayMinutes };
      }),
    });
    const emailPeople = people.filter((p) => p.emailEligible && p.email);
    await tx.emailAutomationRecipient.createMany({
      data: emailPeople.map((p) => ({
        automationId: automation.id, contactType: "former_customer", contactId: p.id, email: p.email!, name: p.name,
        status: "ACTIVE", currentStep: 0, nextSendAt: input.startAt,
      })),
    });

    const campaign = await tx.campaign.create({
      data: {
        name: `Win-back texts: 25% off first month (through ${label})`, body: "", type: "DRIP", active: true, stopOnReply: true,
        channel: "sms", audienceFilter: { leadTypes: ["former_customers"] }, adminEmail: input.adminEmail,
        steps: { create: msgs.texts.map((t, i) => ({ stepOrder: i, body: t.body, delayMinutes: (t.day - (i ? msgs.texts[i - 1].day : 0)) * DAY_MIN })) },
      },
    });
    const smsPeople = people.filter((p) => p.smsEligible && p.phone);
    await tx.campaignRecipient.createMany({
      data: smsPeople.map((p) => ({
        campaignId: campaign.id, leadType: "CUSTOMER" as const, leadId: p.id, phone: p.phone!, name: p.name,
        status: "ACTIVE", currentStep: 0, nextSendAt: new Date(input.startAt.getTime() + msgs.texts[0].day * DAY_MIN * 60_000),
      })),
    });
    const config: WinbackConfig = {
      automationId: automation.id, campaignId: campaign.id, launchedAt: new Date().toISOString(),
      startAt: input.startAt.toISOString(), deadline: input.deadline, signupLink: input.signupLink,
    };
    await tx.appSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
    return { automationId: automation.id, campaignId: campaign.id, emailEnrolled: emailPeople.length, smsEnrolled: smsPeople.length };
  });
  return { automationId, campaignId, emailEnrolled, smsEnrolled };
}

/** Pause (stop sending) or resume both sequences. */
export async function setWinbackActive(active: boolean): Promise<void> {
  const cfg = await getWinbackConfig();
  if (!cfg) throw new Error("No win-back campaign has been launched.");
  await prisma.emailAutomation.update({ where: { id: cfg.automationId }, data: { active } });
  await prisma.campaign.update({ where: { id: cfg.campaignId }, data: { active } });
}

export interface WinbackPerson {
  id: string; name: string; city: string | null;
  email: { status: string; sent: number; total: number; error: string | null } | null;
  text: { status: string; sent: number; total: number; error: string | null } | null;
  cameBack: boolean; cameBackAt: string | null; monthlyRevenue: number | null;
}

/** Progress per person, and who came back after launch. */
export async function winbackStatus() {
  const cfg = await getWinbackConfig();
  if (!cfg) return null;
  const [automation, campaign, emailRecips, textRecips, emailSteps, textSteps] = await Promise.all([
    prisma.emailAutomation.findUnique({ where: { id: cfg.automationId }, select: { active: true } }),
    prisma.campaign.findUnique({ where: { id: cfg.campaignId }, select: { active: true } }),
    prisma.emailAutomationRecipient.findMany({ where: { automationId: cfg.automationId } }),
    prisma.campaignRecipient.findMany({ where: { campaignId: cfg.campaignId } }),
    prisma.emailAutomationStep.count({ where: { automationId: cfg.automationId } }),
    prisma.campaignStep.count({ where: { campaignId: cfg.campaignId } }),
  ]);
  const ids = [...new Set([...emailRecips.map((r) => r.contactId), ...textRecips.map((r) => r.leadId)])];
  const customers = await prisma.sweepandgoCustomer.findMany({
    where: { id: { in: ids } },
    select: { id: true, sngId: true, firstName: true, lastName: true, city: true, active: true, subscriptionNames: true },
  });
  // Return events are keyed "sng-return:<sngId>:<date>", so match by prefix.
  const returnRows = await prisma.subscriptionEvent.findMany({
    where: { kind: "SIGNUP", occurredAt: { gte: new Date(cfg.launchedAt) }, dedupeKey: { startsWith: "sng-return:" } },
    select: { dedupeKey: true, occurredAt: true },
  });
  const returnedAt = new Map<string, Date>();
  for (const r of returnRows) {
    const sng = r.dedupeKey.split(":")[1];
    if (!returnedAt.has(sng) || r.occurredAt < returnedAt.get(sng)!) returnedAt.set(sng, r.occurredAt);
  }
  const byEmail = new Map(emailRecips.map((r) => [r.contactId, r]));
  const byText = new Map(textRecips.map((r) => [r.leadId, r]));
  const people: WinbackPerson[] = customers.map((c) => {
    const e = byEmail.get(c.id), t = byText.get(c.id);
    const at = returnedAt.get(c.sngId) ?? null;
    const cameBack = c.active;
    return {
      id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), city: c.city,
      email: e ? { status: e.status, sent: e.currentStep, total: emailSteps, error: e.error } : null,
      text: t ? { status: t.status, sent: t.currentStep, total: textSteps, error: t.error } : null,
      cameBack, cameBackAt: cameBack && at ? at.toISOString() : null,
      monthlyRevenue: cameBack ? estimateMonthlyRevenue(c.subscriptionNames) : null,
    };
  }).sort((a, b) => Number(b.cameBack) - Number(a.cameBack) || a.name.localeCompare(b.name));
  const back = people.filter((p) => p.cameBack);
  return {
    config: cfg,
    running: !!(automation?.active || campaign?.active),
    totals: {
      emailRecipients: emailRecips.length, emailsSent: emailRecips.reduce((n, r) => n + r.currentStep, 0),
      textRecipients: textRecips.length, textsSent: textRecips.reduce((n, r) => n + r.currentStep, 0),
      cameBack: back.length, monthlyRevenue: back.reduce((n, p) => n + (p.monthlyRevenue ?? 0), 0),
    },
    people,
  };
}
