import prisma from "@/lib/prisma";
import { isKeywordRadarConfigured } from "@/lib/keyword-radar";
import { keywordVolumeStats } from "@/lib/keyword-planner";
import { KeywordRadar, type RadarReport, type RadarItem, type RadarCompetitor } from "@/components/admin/KeywordRadar";

export const dynamic = "force-dynamic";

interface PageProps { searchParams: Promise<{ week?: string }> }

export default async function KeywordRadarPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const history = await prisma.keywordReport.findMany({
    orderBy: { weekOf: "desc" }, take: 12,
    select: { id: true, weekOf: true, generatedAt: true, usedGoogleAds: true },
  });

  const selected = (sp.week && history.find((r) => r.weekOf.toISOString().slice(0, 10) === sp.week)) || history[0] || null;

  const full = selected
    ? await prisma.keywordReport.findUnique({
        where: { id: selected.id },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const [competitors, plannerStats] = await Promise.all([
    prisma.keywordCompetitor.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }] }),
    keywordVolumeStats(),
  ]);

  const report: RadarReport | null = full
    ? {
        id: full.id,
        weekOf: full.weekOf.toISOString(),
        generatedAt: full.generatedAt.toISOString(),
        model: full.model,
        summary: full.summary,
        usedGoogleAds: full.usedGoogleAds,
        items: full.items.map((i): RadarItem => ({
          id: i.id, term: i.term, bucket: i.bucket, intent: i.intent, matchType: i.matchType,
          rationale: i.rationale, adGroup: i.adGroup, competitor: i.competitor,
          monthlySearches: i.monthlySearches, volumeLabel: i.volumeLabel, competition: i.competition,
          topBidLow: i.topBidLow, topBidHigh: i.topBidHigh, source: i.source,
          isNegative: i.isNegative, status: i.status,
        })),
      }
    : null;

  const comps: RadarCompetitor[] = competitors.map((c) => ({ id: c.id, name: c.name, website: c.website, active: c.active }));
  const historyWeeks = history.map((r) => r.weekOf.toISOString());

  return (
    <KeywordRadar
      // Remount when the report or uploaded volumes change so client state isn't stale after a refresh.
      key={`${report?.id ?? "none"}-${report?.generatedAt ?? ""}-${plannerStats.lastUploadedAt ?? ""}`}
      report={report}
      history={historyWeeks}
      competitors={comps}
      plannerStats={plannerStats}
      anthropicConfigured={isKeywordRadarConfigured()}
    />
  );
}
