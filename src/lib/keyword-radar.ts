import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { weekOfMonday } from "@/lib/marketing-director";
import { isGoogleAdsConfigured, generateKeywordIdeas, getSearchTerms, type KeywordMetric } from "@/lib/google-ads";
import { keywordVolumesFor, topLibraryTerms } from "@/lib/keyword-planner";

// ── Keyword Radar ────────────────────────────────────────────────────────────
// A weekly PPC strategist agent. It researches (via live web search) the trending
// keywords in the dog-waste-removal industry and what competitors rank/bid on,
// buckets them into New / Trending / Hot, and — when Google Ads is connected —
// enriches each with real search volume, competition and top-of-page bids, plus
// pulls the account's own search-terms report. Without API production access,
// real numbers come from Keyword Planner CSV uploads (lib/keyword-planner.ts).
// Modeled on the Marketing Director
// (weekly cron, structured output) and Content Studio trends (web-search tool).

const MODEL = "claude-opus-5";

export function isKeywordRadarConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Base seeds always fed to Keyword Planner so we get volume even for terms the
// model didn't surface.
const BASE_SEEDS = [
  "pooper scooper service", "dog poop removal", "dog waste removal service",
  "pet waste removal", "dog poop cleanup service", "yard dog waste service",
  "commercial dog waste removal", "hoa pet waste stations",
];

const BUCKETS = ["NEW", "TRENDING", "HOT"] as const;
const INTENTS = ["commercial", "local", "informational", "branded"] as const;
const MATCH_TYPES = ["exact", "phrase", "broad"] as const;

interface AiKeyword {
  term: string;
  bucket: (typeof BUCKETS)[number];
  intent: string | null;
  matchType: string | null;
  adGroup: string | null;
  competitor: string | null;
  isNegative: boolean;
  rationale: string | null;
}
interface AiOutput { summary: string; keywords: AiKeyword[] }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function systemPrompt(): string {
  return `You are a senior Google Ads / paid-search strategist with 15+ years growing local home-service businesses. Your client is DooGoodScoopers, a professional dog-waste-removal ("pooper scooper") service in California's Inland Empire (San Bernardino & Riverside counties — Fontana, Rancho Cucamonga, Victorville, Apple Valley, Rialto, Moreno Valley, Eastvale, Hesperia, Perris and nearby). They run Google Search Ads for both residential and commercial (HOA / apartment / 55+) pet-waste service.

YOUR JOB: Using live web research, produce THIS WEEK's keyword intelligence report to feed into their Google Ads — the new, trending, and hot search terms worth targeting, plus competitor-driven opportunities and any negatives to exclude.

RESEARCH with the web_search tool:
- Current and rising search language people use for dog-poop / pet-waste removal (residential AND commercial/HOA), including seasonal angles (summer flies/smell, spring winter-buildup, fall/holiday guests).
- What the named competitors emphasize on their sites and ads (service names, taglines, the phrases they rank/bid on) so we can find terms they own and gaps we can take.
- Google autocomplete / "people also search for" style variations and long-tail, high-intent local queries (city + service combos).

BUCKET every keyword:
- "HOT" = high commercial intent, ready-to-buy searches to bid on now (e.g. "dog poop removal service near me").
- "TRENDING" = rising interest / seasonal terms gaining volume right now.
- "NEW" = fresh opportunities or long-tail/competitor-gap terms not obviously covered yet.

For EACH keyword give: intent (commercial | local | informational | branded), a recommended matchType (exact | phrase | broad), the ad group it belongs in, the competitor it's tied to (or null), whether it's a negative keyword to EXCLUDE (isNegative true — e.g. "free", "how to", "diy", jobs/salary, wholesale), and a one-line rationale.

Return ONLY valid JSON, no prose, in exactly this shape:
{
  "summary": "2-4 sentence briefing to the owner: this week's keyword focus and why (season, competitor moves, opportunities).",
  "keywords": [
    { "term": "dog poop removal service near me", "bucket": "HOT", "intent": "commercial", "matchType": "phrase", "adGroup": "Residential – Near Me", "competitor": null, "isNegative": false, "rationale": "High-intent local buyer searching to hire now." }
  ]
}
Aim for 18-28 keywords total across the buckets, concrete and specific to this business, region, and season. Include a few negatives. Do NOT invent search-volume numbers — leave those to the data layer.`;
}

interface PlannerHint { displayTerm: string; volumeLabel: string | null; competition: string | null }

function userPrompt(competitors: { name: string; website: string | null }[], zips: string[], planner: PlannerHint[]): string {
  const comp = competitors.length
    ? competitors.map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""}`).join("\n")
    : "- (none specified; research the main national + local pooper-scooper competitors)";
  const today = new Date().toISOString().slice(0, 10);
  const plannerBlock = planner.length
    ? `\nReal Google Keyword Planner data the owner uploaded (avg monthly searches · competition). Use it to prioritize — favor terms with real volume, and don't contradict these numbers:\n${planner.map((p) => `- ${p.displayTerm}: ${p.volumeLabel ?? "?"}/mo${p.competition ? ` · ${p.competition.toLowerCase()} competition` : ""}`).join("\n")}\n`
    : "";
  return `Today is ${today}. Research and produce this week's keyword report.

Competitors to study:
${comp}

Our busiest customer ZIP codes (bias local/long-tail suggestions toward these areas): ${zips.length ? zips.join(", ") : "Inland Empire, CA"}
${plannerBlock}
Return the JSON exactly as specified. Use web_search to ground it in what people are actually searching and what these competitors are doing right now.`;
}

function extractJson(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceKeyword(raw: any): AiKeyword | null {
  const term = typeof raw?.term === "string" ? raw.term.trim() : "";
  if (!term || term.length > 120) return null;
  const bucket = BUCKETS.includes(raw?.bucket) ? raw.bucket : "NEW";
  const intent = INTENTS.includes(raw?.intent) ? raw.intent : null;
  const matchType = MATCH_TYPES.includes(raw?.matchType) ? raw.matchType : null;
  return {
    term,
    bucket,
    intent,
    matchType,
    adGroup: typeof raw?.adGroup === "string" ? raw.adGroup.trim().slice(0, 80) || null : null,
    competitor: typeof raw?.competitor === "string" && raw.competitor.trim() ? raw.competitor.trim().slice(0, 80) : null,
    isNegative: raw?.isNegative === true,
    rationale: typeof raw?.rationale === "string" ? raw.rationale.trim().slice(0, 300) || null : null,
  };
}

async function callModel(anthropic: Anthropic, prompt: string, sys: string, useSearch: boolean): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: sys,
    ...(useSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }] } : {}),
    messages: [{ role: "user", content: prompt }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function researchKeywords(): Promise<AiOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const [competitors, zipRows, planner] = await Promise.all([
    prisma.keywordCompetitor.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sweepandgoCustomer.groupBy({ by: ["zipCode"], where: { active: true, zipCode: { not: null } }, _count: { _all: true } }),
    topLibraryTerms(40),
  ]);
  const zips = zipRows
    .map((z) => ({ zip: z.zipCode as string, n: z._count._all }))
    .sort((a, b) => b.n - a.n).slice(0, 8).map((z) => z.zip);

  const sys = systemPrompt();
  const prompt = userPrompt(competitors, zips, planner);

  let text = "";
  try {
    text = await callModel(anthropic, prompt, sys, true);
  } catch (e) {
    console.warn("[keyword-radar] web-search failed, retrying without search:", e instanceof Error ? e.message : e);
    text = await callModel(anthropic, prompt, sys, false);
  }

  const parsed = extractJson(text) as { summary?: unknown; keywords?: unknown[] } | null;
  if (!parsed) return null;
  const keywords = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
    .map(coerceKeyword)
    .filter((k): k is AiKeyword => k !== null);
  // Dedupe by normalized term.
  const seen = new Set<string>();
  const deduped = keywords.filter((k) => { const key = norm(k.term); if (seen.has(key)) return false; seen.add(key); return true; });
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "This week's keyword opportunities for Google Ads.",
    keywords: deduped,
  };
}

const compBucket = (c: string | null) =>
  c === "LOW" || c === "MEDIUM" || c === "HIGH" ? c : null;

export interface SaveResult { ok: boolean; reportId?: string; skipped?: boolean; error?: string; itemCount?: number }

/** Generate and persist this week's keyword report. Idempotent per week unless `force`. */
export async function generateAndSaveWeeklyReport(opts: { force?: boolean } = {}): Promise<SaveResult> {
  if (!isKeywordRadarConfigured()) return { ok: false, error: "ANTHROPIC_API_KEY is not set in this environment." };
  const weekOf = weekOfMonday();
  const existing = await prisma.keywordReport.findUnique({ where: { weekOf } });
  if (existing && !opts.force) return { ok: true, reportId: existing.id, skipped: true };

  const ai = await researchKeywords();
  if (!ai) return { ok: false, error: "The keyword agent returned no usable output." };

  // ── Enrich with real Google Ads data when connected ───────────────────────
  const useGoogleAds = isGoogleAdsConfigured();
  const metricByTerm = new Map<string, KeywordMetric>();
  let searchTerms: { term: string; impressions: number; clicks: number; conversions: number }[] = [];
  if (useGoogleAds) {
    const seeds = [...new Set([...ai.keywords.filter((k) => !k.isNegative).map((k) => k.term), ...BASE_SEEDS])].slice(0, 20);
    const [ideas, terms] = await Promise.all([generateKeywordIdeas(seeds), getSearchTerms(30)]);
    for (const m of ideas) metricByTerm.set(norm(m.text), m);
    searchTerms = terms;
  }

  // Keyword Planner uploads fill in real numbers wherever the API didn't.
  const planner = await keywordVolumesFor(ai.keywords.map((k) => k.term));

  interface ItemDraft {
    term: string; bucket: string; intent: string | null; matchType: string | null; rationale: string | null;
    adGroup: string | null; competitor: string | null; monthlySearches: number | null; volumeLabel: string | null;
    competition: string | null; topBidLow: number | null; topBidHigh: number | null; source: string; isNegative: boolean;
  }
  const drafts: ItemDraft[] = [];
  const included = new Set<string>();

  for (const k of ai.keywords) {
    const m = metricByTerm.get(norm(k.term));
    const p = planner.get(norm(k.term));
    included.add(norm(k.term));
    drafts.push({
      term: k.term, bucket: k.bucket, intent: k.intent, matchType: k.matchType, rationale: k.rationale,
      adGroup: k.adGroup, competitor: k.competitor,
      ...(m
        ? {
            monthlySearches: m.avgMonthlySearches,
            volumeLabel: m.avgMonthlySearches != null ? m.avgMonthlySearches.toLocaleString("en-US") : null,
            competition: compBucket(m.competition), topBidLow: m.lowTopBid, topBidHigh: m.highTopBid,
          }
        : {
            monthlySearches: p?.monthlySearches ?? null, volumeLabel: p?.volumeLabel ?? null,
            competition: p?.competition ?? null, topBidLow: p?.topBidLow ?? null, topBidHigh: p?.topBidHigh ?? null,
          }),
      source: "ai", isNegative: k.isNegative,
    });
  }

  // Add high-volume Keyword Planner ideas the model didn't surface (real opportunities).
  if (useGoogleAds) {
    const extraIdeas = [...metricByTerm.values()]
      .filter((m) => !included.has(norm(m.text)) && (m.avgMonthlySearches ?? 0) >= 30)
      .sort((a, b) => (b.avgMonthlySearches ?? 0) - (a.avgMonthlySearches ?? 0))
      .slice(0, 12);
    for (const m of extraIdeas) {
      included.add(norm(m.text));
      drafts.push({
        term: m.text, bucket: "NEW", intent: null, matchType: "phrase",
        rationale: "Keyword Planner idea with real search volume the AI didn't surface.",
        adGroup: null, competitor: null,
        monthlySearches: m.avgMonthlySearches,
        volumeLabel: m.avgMonthlySearches != null ? m.avgMonthlySearches.toLocaleString("en-US") : null,
        competition: compBucket(m.competition),
        topBidLow: m.lowTopBid, topBidHigh: m.highTopBid, source: "google_ads", isNegative: false,
      });
    }
    // The account's own recent search terms = proven demand → HOT.
    const topTerms = searchTerms
      .filter((t) => !included.has(norm(t.term)) && t.impressions >= 1)
      .slice(0, 12);
    for (const t of topTerms) {
      included.add(norm(t.term));
      drafts.push({
        term: t.term, bucket: "HOT", intent: "commercial", matchType: "exact",
        rationale: `Already triggered your ads: ${t.impressions} impressions, ${t.clicks} clicks, ${t.conversions} conv. (30d).`,
        adGroup: "From your search terms", competitor: null,
        monthlySearches: null, volumeLabel: null, competition: null, topBidLow: null, topBidHigh: null,
        source: "google_ads", isNegative: false,
      });
    }
  }

  // High-volume terms from Keyword Planner uploads that the agent didn't surface.
  const negatives = new Set(ai.keywords.filter((k) => k.isNegative).map((k) => norm(k.term)));
  const libraryIdeas = (await topLibraryTerms(20))
    .filter((v) => !included.has(v.term) && !negatives.has(v.term) && (v.monthlySearches ?? 0) >= 30)
    .slice(0, 10);
  for (const v of libraryIdeas) {
    included.add(v.term);
    drafts.push({
      term: v.displayTerm, bucket: "NEW", intent: null, matchType: "phrase",
      rationale: "From your Keyword Planner upload: real search volume the agent didn't surface this week.",
      adGroup: null, competitor: null,
      monthlySearches: v.monthlySearches, volumeLabel: v.volumeLabel, competition: v.competition,
      topBidLow: v.topBidLow, topBidHigh: v.topBidHigh, source: "keyword_planner", isNegative: false,
    });
  }

  if (existing) {
    await prisma.keywordItem.deleteMany({ where: { reportId: existing.id } });
    await prisma.keywordReport.delete({ where: { id: existing.id } });
  }

  const report = await prisma.keywordReport.create({
    data: {
      weekOf, summary: ai.summary, model: MODEL, usedGoogleAds: useGoogleAds,
      items: {
        create: drafts.map((d, i) => ({ ...d, weekOf, sortOrder: i })),
      },
    },
  });
  return { ok: true, reportId: report.id, itemCount: drafts.length };
}
