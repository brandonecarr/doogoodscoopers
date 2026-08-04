import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isTrendEngineConfigured, refreshTrendTemplates } from "@/lib/studio/trends";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // trend research + generation can take a while

// GET → active AI templates for the Studio gallery (newest first).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.studioTemplate.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const templates = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags,
    format: r.format,
    trend: r.trend,
    createdAt: r.createdAt,
    slides: r.data,
  }));
  return NextResponse.json({ templates });
}

// POST → generate a fresh batch on demand ("Find fresh trends" button).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isTrendEngineConfigured()) {
    return NextResponse.json(
      { error: "AI trend engine isn't configured — set ANTHROPIC_API_KEY to enable it." },
      { status: 200 },
    );
  }
  try {
    const { added, generated } = await refreshTrendTemplates(3);
    const message = added
      ? `Added ${added} fresh template${added === 1 ? "" : "s"}.`
      : generated
        ? "The trends we found were already in your library."
        : "Couldn't design new templates this time — try again.";
    return NextResponse.json({ added, generated, message });
  } catch (e) {
    console.error("[studio-templates] generate failed:", e);
    return NextResponse.json({ error: "Trend generation failed. Please try again." }, { status: 500 });
  }
}
