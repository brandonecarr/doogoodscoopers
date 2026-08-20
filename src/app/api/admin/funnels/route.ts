import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { DEFAULT_BOOKING_URL, type FunnelData } from "@/lib/funnel/types";

// Admin CRUD for funnels (System A auth). GET lists; POST creates or updates.
export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "funnel";

/** A blank starter funnel: one ZIP step. */
export function starterFunnel(): FunnelData {
  return {
    theme: { primary: "#6D3EF0", bg: "#0E2A47" },
    settings: { bookingUrl: DEFAULT_BOOKING_URL, metaTitle: "Get a Quote" },
    variants: {
      A: {
        steps: [
          {
            id: "zip", name: "ZIP check",
            blocks: [
              { id: "h1", type: "heading", text: "Get your free quote in 60 seconds" },
              { id: "t1", type: "text", text: "First, let us make sure we serve your neighborhood." },
              { id: "z1", type: "zipCheck", label: "Check my area" },
            ],
            logic: [{ field: "inServiceArea", op: "eq", value: "false", goto: "outofarea" }],
          },
          {
            id: "contact", name: "Contact",
            blocks: [
              { id: "h2", type: "heading", text: "Where should we send it?" },
              { id: "cf1", type: "contactForm", fields: ["firstName", "phone", "email"] },
              { id: "cta1", type: "cta", ctaKind: "submit", label: "Get my quote" },
            ],
          },
          {
            id: "done", name: "Thank you",
            blocks: [
              { id: "h3", type: "heading", text: "You are all set!" },
              { id: "t2", type: "text", text: "We will text you shortly to schedule." },
              { id: "cta2", type: "cta", ctaKind: "booking", label: "Book my first cleanup" },
            ],
          },
          {
            id: "outofarea", name: "Out of area",
            blocks: [
              { id: "h4", type: "heading", text: "We are not in your area yet" },
              { id: "cf2", type: "contactForm", fields: ["firstName", "phone", "email"] },
              { id: "cta3", type: "cta", ctaKind: "submit", label: "Notify me" },
            ],
          },
        ],
      },
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const funnels = await prisma.funnel.findMany({
    select: { id: true, slug: true, name: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ funnels });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Update existing
  if (body.id) {
    const data: Prisma.FunnelUpdateInput = { name };
    if (body.slug) data.slug = slugify(body.slug);
    if (body.status === "published" || body.status === "draft") data.status = body.status;
    if (body.data) data.data = body.data as Prisma.InputJsonValue;
    try {
      const f = await prisma.funnel.update({ where: { id: String(body.id) }, data });
      return NextResponse.json({ id: f.id, slug: f.slug, status: f.status });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "That URL slug is already taken." }, { status: 409 });
      }
      throw e;
    }
  }

  // Create new — ensure a unique slug.
  let slug = slugify(body.slug || name);
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.funnel.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${slugify(body.slug || name)}-${i + 2}`;
  }
  const funnelData = (body.data as FunnelData) || starterFunnel();
  const f = await prisma.funnel.create({
    data: { name, slug, status: "draft", data: funnelData as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ id: f.id, slug: f.slug, status: f.status });
}
