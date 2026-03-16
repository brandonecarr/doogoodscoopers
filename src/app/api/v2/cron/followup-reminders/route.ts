/**
 * Followup Reminder Cron
 *
 * Runs every 30 minutes. Sends Web Push notifications to all subscribed
 * admin devices for:
 *   - Leads with a followup due in the next 30 minutes ("Due soon")
 *   - Leads that are overdue (followupDate in the past, not yet closed)
 *
 * GET /api/v2/cron/followup-reminders
 * Authentication: CRON_SECRET Bearer token
 */

import { NextRequest, NextResponse } from "next/server";
import { type LeadStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendAdminPush } from "@/lib/web-push";

const LEAD_TYPE_LABELS: Record<string, string> = {
  quote: "Quote Lead",
  outofarea: "Out-of-Area Lead",
  career: "Career Application",
  commercial: "Commercial Lead",
  adlead: "Ad Lead",
};

const LEAD_TYPE_PATHS: Record<string, string> = {
  quote: "/admin/quote-leads",
  outofarea: "/admin/out-of-area-leads",
  career: "/admin/careers",
  commercial: "/admin/commercial-leads",
  adlead: "/admin/ad-leads",
};

type LeadRow = { id: string; firstName?: string | null; lastName?: string | null };

function fullName(lead: LeadRow): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
}

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Window: leads due in the next 30 minutes
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

  // Past due: before now, status not CONVERTED/LOST, not archived
  const overdueFilter = {
    followupDate: { lt: now },
    archived: false,
    status: { notIn: ["CONVERTED", "NOT_INTERESTED"] as LeadStatus[] },
  };

  // Due soon filter
  const dueSoonFilter = {
    followupDate: { gte: windowStart, lte: windowEnd },
    archived: false,
    status: { notIn: ["CONVERTED", "NOT_INTERESTED"] as LeadStatus[] },
  };

  const [
    quoteDue,    quoteOverdue,
    ooaDue,      ooaOverdue,
    careerDue,   careerOverdue,
    commercialDue, commercialOverdue,
    adDue,       adOverdue,
  ] = await Promise.all([
    prisma.quoteLead.findMany({ where: dueSoonFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.quoteLead.findMany({ where: overdueFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.outOfAreaLead.findMany({ where: dueSoonFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.outOfAreaLead.findMany({ where: overdueFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.careerApplication.findMany({ where: dueSoonFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.careerApplication.findMany({ where: overdueFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.commercialLead.findMany({
      where: {
        followupDate: dueSoonFilter.followupDate,
        archived: false,
        status: { notIn: ["CONVERTED", "NOT_INTERESTED"] as LeadStatus[] },
      },
      select: { id: true, contactName: true },
    }),
    prisma.commercialLead.findMany({
      where: {
        followupDate: overdueFilter.followupDate,
        archived: false,
        status: { notIn: ["CONVERTED", "NOT_INTERESTED"] as LeadStatus[] },
      },
      select: { id: true, contactName: true },
    }),
    prisma.adLead.findMany({ where: dueSoonFilter,  select: { id: true, firstName: true, lastName: true } }),
    prisma.adLead.findMany({ where: overdueFilter,  select: { id: true, firstName: true, lastName: true } }),
  ]);

  const notifications: Promise<unknown>[] = [];

  // ── Due-soon: individual notification per lead ────────────────────────────
  const dueGroups: Array<{ type: string; leads: { id: string; name: string }[] }> = [
    { type: "quote",      leads: quoteDue.map((l) => ({ id: l.id, name: fullName(l) })) },
    { type: "outofarea",  leads: ooaDue.map((l) => ({ id: l.id, name: fullName(l) })) },
    { type: "career",     leads: careerDue.map((l) => ({ id: l.id, name: fullName(l) })) },
    { type: "commercial", leads: commercialDue.map((l) => ({ id: l.id, name: l.contactName })) },
    { type: "adlead",     leads: adDue.map((l) => ({ id: l.id, name: fullName(l) })) },
  ];

  for (const { type, leads } of dueGroups) {
    for (const lead of leads) {
      notifications.push(
        sendAdminPush({
          title: "📅 Followup Due",
          body: `${lead.name} — ${LEAD_TYPE_LABELS[type]}`,
          url: `${LEAD_TYPE_PATHS[type]}/${lead.id}`,
          tag: `due-${lead.id}`,
        })
      );
    }
  }

  // ── Overdue: single grouped notification ──────────────────────────────────
  const overdueCount =
    quoteOverdue.length +
    ooaOverdue.length +
    careerOverdue.length +
    commercialOverdue.length +
    adOverdue.length;

  if (overdueCount > 0) {
    // Surface the most-overdue lead for the notification URL
    const firstOverdue =
      quoteOverdue[0] || ooaOverdue[0] || careerOverdue[0] || adOverdue[0];
    const firstType = quoteOverdue.length
      ? "quote"
      : ooaOverdue.length
      ? "outofarea"
      : careerOverdue.length
      ? "career"
      : adOverdue.length
      ? "adlead"
      : "commercial";

    notifications.push(
      sendAdminPush({
        title: `⚠️ ${overdueCount} Overdue Followup${overdueCount !== 1 ? "s" : ""}`,
        body:
          overdueCount === 1
            ? `${firstOverdue ? fullName(firstOverdue as LeadRow) : "A lead"} needs follow-up`
            : `${overdueCount} leads are past their scheduled follow-up date`,
        url: firstOverdue
          ? `${LEAD_TYPE_PATHS[firstType]}/${firstOverdue.id}`
          : LEAD_TYPE_PATHS[firstType],
        tag: "overdue-summary",
        renotify: true,
      })
    );
  }

  await Promise.allSettled(notifications);

  const dueSoonCount = dueGroups.reduce((sum, g) => sum + g.leads.length, 0);

  return NextResponse.json({
    ok: true,
    dueSoon: dueSoonCount,
    overdue: overdueCount,
    notificationsSent: notifications.length,
  });
}
