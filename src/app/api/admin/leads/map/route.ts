import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";
import { isMapboxConfigured, normalizeZip, resolveZips } from "@/lib/geo/zipgeo";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // first load may geocode a batch of new zips

interface MapLead {
  id: string;
  type: "quote" | "ad" | "instagram";
  name: string;
  status: LeadStatus;
  grade: string | null;
  createdAt: string;
}
interface MapPoint {
  zip: string;
  lat: number;
  lng: number;
  place: string;
  count: number;
  statusCounts: Record<string, number>; // full breakdown (not capped)
  leads: MapLead[];
}

const LEADS_PER_POINT = 30; // cap the popup list; count reflects the true total

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const source = searchParams.get("source");
    const days = Math.max(0, parseInt(searchParams.get("days") || "0"));

    const statusFilter = status && status !== "all" ? (status as LeadStatus) : undefined;
    const includeQuote = !source || source === "all" || source === "quote";
    const includeAd = !source || source === "all" || source === "ad";
    const includeInsta = !source || source === "all" || source === "instagram";
    const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

    const base = (extraSearch: Record<string, unknown>[]): Record<string, unknown> => {
      const w: Record<string, unknown> = { archived: false };
      if (statusFilter) w.status = statusFilter;
      if (cutoff) w.createdAt = { gte: cutoff };
      if (search) w.OR = extraSearch;
      return w;
    };
    const quoteWhere = base([
      { firstName: { contains: search ?? "", mode: "insensitive" } },
      { lastName: { contains: search ?? "", mode: "insensitive" } },
      { email: { contains: search ?? "", mode: "insensitive" } },
      { phone: { contains: search ?? "", mode: "insensitive" } },
      { zipCode: { contains: search ?? "", mode: "insensitive" } },
    ]);
    const adWhere = base([
      { firstName: { contains: search ?? "", mode: "insensitive" } },
      { lastName: { contains: search ?? "", mode: "insensitive" } },
      { fullName: { contains: search ?? "", mode: "insensitive" } },
      { email: { contains: search ?? "", mode: "insensitive" } },
      { phone: { contains: search ?? "", mode: "insensitive" } },
    ]);
    const instaWhere = base([
      { username: { contains: search ?? "", mode: "insensitive" } },
      { firstName: { contains: search ?? "", mode: "insensitive" } },
      { email: { contains: search ?? "", mode: "insensitive" } },
      { phone: { contains: search ?? "", mode: "insensitive" } },
    ]);

    const [quotes, ads, instas] = await Promise.all([
      includeQuote
        ? prisma.quoteLead.findMany({ where: quoteWhere, select: { id: true, firstName: true, lastName: true, zipCode: true, status: true, grade: true, createdAt: true } })
        : Promise.resolve([]),
      includeAd
        ? prisma.adLead.findMany({ where: adWhere, select: { id: true, firstName: true, lastName: true, fullName: true, zipCode: true, status: true, grade: true, createdAt: true } })
        : Promise.resolve([]),
      includeInsta
        ? prisma.instagramLead.findMany({ where: instaWhere, select: { id: true, username: true, firstName: true, lastName: true, zipCode: true, status: true, grade: true, createdAt: true } })
        : Promise.resolve([]),
    ]);

    // Flatten to a common shape with a normalized zip.
    const all: (MapLead & { zip: string | null })[] = [
      ...quotes.map((l) => ({ id: l.id, type: "quote" as const, name: `${l.firstName} ${l.lastName || ""}`.trim(), status: l.status as LeadStatus, grade: l.grade, createdAt: l.createdAt.toISOString(), zip: normalizeZip(l.zipCode) })),
      ...ads.map((l) => ({ id: l.id, type: "ad" as const, name: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown", status: l.status as LeadStatus, grade: l.grade, createdAt: l.createdAt.toISOString(), zip: normalizeZip(l.zipCode) })),
      ...instas.map((l) => ({ id: l.id, type: "instagram" as const, name: l.username ? `@${l.username}` : `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Instagram user", status: l.status as LeadStatus, grade: l.grade, createdAt: l.createdAt.toISOString(), zip: normalizeZip(l.zipCode) })),
    ];

    const withZip = all.filter((l) => l.zip !== null);
    const coords = await resolveZips(withZip.map((l) => l.zip));

    // Group by zip → point.
    const byZip = new Map<string, MapPoint>();
    for (const l of withZip) {
      const zip = l.zip!;
      const c = coords.get(zip);
      if (!c) continue; // couldn't geocode this zip
      let p = byZip.get(zip);
      if (!p) {
        p = { zip, lat: c.lat, lng: c.lng, place: c.place, count: 0, statusCounts: {}, leads: [] };
        byZip.set(zip, p);
      }
      p.count++;
      p.statusCounts[l.status] = (p.statusCounts[l.status] || 0) + 1;
      if (p.leads.length < LEADS_PER_POINT) {
        const { id, type, name, status: s, grade, createdAt } = l;
        p.leads.push({ id, type, name, status: s, grade, createdAt });
      }
    }

    const points = Array.from(byZip.values()).sort((a, b) => b.count - a.count);
    const mappedLeads = points.reduce((sum, p) => sum + p.count, 0);

    return NextResponse.json({
      configured: isMapboxConfigured(),
      points,
      totalLeads: all.length,
      mappedLeads,
      noZip: all.length - withZip.length,
      ungeocoded: withZip.length - mappedLeads,
    });
  } catch (error) {
    console.error("Error building leads map:", error);
    return NextResponse.json({ error: "Failed to build leads map" }, { status: 500 });
  }
}
