import prisma from "@/lib/prisma";
import { isGoogleAdsConfigured } from "@/lib/google-ads";
import { isKeywordRadarConfigured } from "@/lib/keyword-radar";
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

  const competitors = await prisma.keywordCompetitor.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }] });

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
          monthlySearches: i.monthlySearches, competition: i.competition,
          topBidLow: i.topBidLow, topBidHigh: i.topBidHigh, source: i.source,
          isNegative: i.isNegative, status: i.status,
        })),
      }
    : null;

  const comps: RadarCompetitor[] = competitors.map((c) => ({ id: c.id, name: c.name, website: c.website, active: c.active }));
  const historyWeeks = history.map((r) => r.weekOf.toISOString());

  return (
    <KeywordRadar
      report={report}
      history={historyWeeks}
      competitors={comps}
      googleAdsConfigured={isGoogleAdsConfigured()}
      anthropicConfigured={isKeywordRadarConfigured()}
    />
  );
}
