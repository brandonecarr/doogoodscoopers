import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseKeywordPlannerCsv, saveKeywordVolumes, applyVolumesToReport } from "@/lib/keyword-planner";

// Upload a Google Ads Keyword Planner CSV export. Saves the real search volume /
// competition / bids to the library, then fills them onto the report being viewed
// (or the latest one). Future weekly reports pick the numbers up automatically.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a Keyword Planner .csv file to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 5 MB — export fewer keywords at a time." }, { status: 400 });

  const parsed = parseKeywordPlannerCsv(new Uint8Array(await file.arrayBuffer()));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const imported = await saveKeywordVolumes(parsed.rows, file.name.slice(0, 200));

  const reportIdRaw = form?.get("reportId");
  const reportId = typeof reportIdRaw === "string" && reportIdRaw
    ? reportIdRaw
    : (await prisma.keywordReport.findFirst({ orderBy: { weekOf: "desc" }, select: { id: true } }))?.id;
  const matched = reportId ? await applyVolumesToReport(reportId) : 0;

  const ranges = parsed.rows.filter((r) => r.searchesLow != null && r.searchesLow !== r.searchesHigh).length;
  return NextResponse.json({ ok: true, imported, matched, skipped: parsed.skipped, ranges });
}
