import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// A calendar event is either a lead follow-up (derived live from a lead table's
// followupDate — read-only here, edited on the lead itself) or a manual entry
// the user added by hand (fully editable). The `id` is namespaced so the client
// can tell them apart: `followup:<type>:<leadId>` vs `manual:<entryId>`.
export interface CalendarEvent {
  id: string;
  kind: "followup" | "manual";
  title: string;
  start: string;        // ISO
  end: string | null;   // ISO, manual entries only
  allDay: boolean;
  // follow-up extras
  leadType?: string;
  href?: string;
  status?: string | null;
  grade?: string | null;
  subtitle?: string | null;
  // manual extras
  notes?: string | null;
  location?: string | null;
  color?: string | null;
}

const FOLLOWUP_SELECT_RESIDENTIAL = {
  id: true, firstName: true, lastName: true, followupDate: true, status: true, grade: true, zipCode: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    // Default to a wide window (this month ± a bit) if the client didn't scope it.
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 45 * 86_400_000);
    const to = toStr ? new Date(toStr) : new Date(Date.now() + 120 * 86_400_000);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const range = { gte: from, lte: to };

    const [quotes, ads, instas, canvs, commercials, prospects, manual] = await Promise.all([
      prisma.quoteLead.findMany({ where: { archived: false, followupDate: range }, select: FOLLOWUP_SELECT_RESIDENTIAL }),
      prisma.adLead.findMany({ where: { archived: false, followupDate: range }, select: { id: true, firstName: true, lastName: true, fullName: true, followupDate: true, status: true, grade: true, zipCode: true } }),
      prisma.instagramLead.findMany({ where: { archived: false, followupDate: range }, select: { id: true, username: true, firstName: true, lastName: true, followupDate: true, status: true, grade: true, zipCode: true } }),
      prisma.canvasserLead.findMany({ where: { archived: false, followupDate: range }, select: FOLLOWUP_SELECT_RESIDENTIAL }),
      prisma.commercialLead.findMany({ where: { archived: false, followupDate: range }, select: { id: true, contactName: true, propertyName: true, followupDate: true, status: true, grade: true, city: true } }),
      prisma.commercialProspect.findMany({ where: { status: { not: "ARCHIVED" }, followupDate: range }, select: { id: true, propertyName: true, contactName: true, followupDate: true, status: true, grade: true, city: true } }),
      prisma.calendarEntry.findMany({ where: { startAt: range } }),
    ]);

    const events: CalendarEvent[] = [];

    for (const l of quotes) {
      events.push({
        id: `followup:quote:${l.id}`, kind: "followup", leadType: "quote",
        title: `${l.firstName} ${l.lastName || ""}`.trim() || "Quote lead",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/quote-leads/${l.id}`, status: l.status, grade: l.grade,
        subtitle: l.zipCode ? `Quote · ${l.zipCode}` : "Quote lead",
      });
    }
    for (const l of ads) {
      events.push({
        id: `followup:adlead:${l.id}`, kind: "followup", leadType: "adlead",
        title: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Meta lead",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/ad-leads/${l.id}`, status: l.status, grade: l.grade,
        subtitle: l.zipCode ? `Meta ad · ${l.zipCode}` : "Meta ad lead",
      });
    }
    for (const l of instas) {
      events.push({
        id: `followup:instagram:${l.id}`, kind: "followup", leadType: "instagram",
        title: l.username ? `@${l.username}` : `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Instagram lead",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/instagram-leads/${l.id}`, status: l.status, grade: l.grade,
        subtitle: "Instagram lead",
      });
    }
    for (const l of canvs) {
      events.push({
        id: `followup:canvasser:${l.id}`, kind: "followup", leadType: "canvasser",
        title: `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Canvasser lead",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/canvasser-leads/${l.id}`, status: l.status, grade: l.grade,
        subtitle: l.zipCode ? `Canvasser · ${l.zipCode}` : "Canvasser lead",
      });
    }
    for (const l of commercials) {
      events.push({
        id: `followup:commercial:${l.id}`, kind: "followup", leadType: "commercial",
        title: l.propertyName || l.contactName || "Commercial lead",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/leads/commercial/${l.id}`, status: l.status, grade: l.grade,
        subtitle: l.contactName ? `Commercial · ${l.contactName}` : "Commercial lead",
      });
    }
    for (const l of prospects) {
      events.push({
        id: `followup:prospect:${l.id}`, kind: "followup", leadType: "prospect",
        title: l.propertyName || l.contactName || "Prospect",
        start: l.followupDate!.toISOString(), end: null, allDay: false,
        href: `/admin/leads/commercial/call-list/${l.id}`, status: l.status, grade: l.grade,
        subtitle: l.city ? `Call list · ${l.city}` : "Call list prospect",
      });
    }
    for (const e of manual) {
      events.push({
        id: `manual:${e.id}`, kind: "manual", title: e.title,
        start: e.startAt.toISOString(), end: e.endAt ? e.endAt.toISOString() : null,
        allDay: e.allDay, notes: e.notes, location: e.location, color: e.color,
      });
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching calendar:", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!body.startAt) return NextResponse.json({ error: "Start date/time is required" }, { status: 400 });

    const startAt = new Date(body.startAt);
    if (isNaN(startAt.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    let endAt: Date | null = null;
    if (body.endAt) {
      endAt = new Date(body.endAt);
      if (isNaN(endAt.getTime())) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
      if (endAt < startAt) return NextResponse.json({ error: "End must be after start" }, { status: 400 });
    }

    const entry = await prisma.calendarEntry.create({
      data: {
        title,
        startAt,
        endAt,
        allDay: !!body.allDay,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        location: typeof body.location === "string" && body.location.trim() ? body.location.trim() : null,
        color: typeof body.color === "string" && body.color.trim() ? body.color.trim() : null,
      },
    });
    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error("Error creating calendar entry:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
