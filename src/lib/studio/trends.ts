import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { LAYOUTS, GRADIENTS, TEMPLATES, type Slide, type Format } from "@/lib/studio/templates";

/**
 * AI trend engine for the Content Studio.
 *
 * Instagram/TikTok expose no legal, stable feed of "trending posts" to scrape,
 * so instead we do the honest, durable thing: ask Claude — with its live
 * web-search tool — to research which carousel *formats and hooks* are trending
 * right now, then design fresh, on-brand DooGoodScoopers templates in those
 * formats. A weekly cron keeps the library current; the admin can also trigger
 * it on demand. Everything the model returns is validated/coerced against the
 * exact Slide schema before it can reach the database or the editor.
 */

const MODEL = "claude-opus-5";

export function isTrendEngineConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Types the model must produce (post-validation) ───────────────────────────
type GenSlide = Omit<Slide, "id" | "bgImage" | "overlay">;
export interface GenTemplate {
  name: string;
  description: string;
  tags: string[];
  format: Format;
  trend: string;
  slides: GenSlide[];
}

const LAYOUT_IDS = Object.keys(LAYOUTS);
const THEME_IDS = ["navy", "blue", "white", "mint", "ink", "alert", "sun"];
const FONT_IDS = ["sans", "display"];
const DECOR_IDS = ["paws", "blob", "stripe", "dots", "none"];
const POS_IDS = ["top", "center", "bottom"];
const GRADIENT_IDS = GRADIENTS.map((g) => g.id);

// ── Brand + schema the model is designing within ─────────────────────────────
const BRAND = `BUSINESS: DooGoodScoopers — a professional dog-waste removal / pooper-scooper service in the Inland Empire (Southern California).
VOICE: friendly, punchy, a little playful, benefit-driven. Speaks to busy dog owners who hate scooping.
GOAL of every carousel: stop the scroll, deliver quick value or intrigue, and end on a comment-to-DM call to action.
CTA CONVENTION: the last slide is always a "cta" layout. The comment word ("big") is a short all-caps keyword (usually SCOOP or NO MORE POOP). Footer is exactly: "doogoodscoopers.com  •  (909) 366-3744".
FACTS you may use: weekly service from ~$20/week; 5.0 stars across 45+ Google reviews; serves the Inland Empire; twice-a-week and one-time options exist.`;

function fieldSpec(): string {
  return LAYOUT_IDS.map((id) => {
    const def = LAYOUTS[id as keyof typeof LAYOUTS];
    const fields = def.fields
      .map((f) => `${f.key} (${f.type}${f.type === "list" ? " → array of strings" : f.type === "toggle" ? " → boolean" : ""})`)
      .join(", ");
    return `- "${id}" (${def.name}): fields = { ${fields} }`;
  }).join("\n");
}

function systemPrompt(): string {
  return `You are a senior social-media designer producing Instagram carousel TEMPLATES for one brand.

${BRAND}

You are designing within a fixed rendering system. Each template is a small set of slides. Every slide is an object:
{
  "layout": one of ${LAYOUT_IDS.map((x) => `"${x}"`).join(" | ")},
  "theme": one of ${THEME_IDS.map((x) => `"${x}"`).join(" | ")},
  "font": "sans" (clean Montserrat) | "display" (bold condensed Bebas — great for punchy hooks),
  "decor": ${DECOR_IDS.map((x) => `"${x}"`).join(" | ")},
  "textPos": "top" | "center" | "bottom" (optional),
  "gradient": optional, one of ${GRADIENT_IDS.map((x) => `"${x}"`).join(" | ")} (a colorful gradient background instead of the flat theme color),
  "showLogo": boolean (default true),
  "showSwipe": boolean (default true; the last slide should set it false),
  "fields": an object whose keys depend on the layout
}

LAYOUT FIELDS (use exactly these keys for each layout):
${fieldSpec()}

TEXT MARKUP inside any field string: wrap words in **double asterisks** to highlight them in the accent color, or ~~double tildes~~ to color them red/alarm. Use \\n for a line break. Keep headlines SHORT (they render very large). Emojis are welcome and on-brand.

DESIGN RULES:
- 3–5 slides per template. The FIRST slide is a scroll-stopping hook (cover/statement/stat). The LAST slide is ALWAYS layout "cta" with showSwipe:false.
- Give each template a distinct visual identity: vary theme, font, and decor between templates so they don't all look alike. "display" font + a bold theme (navy/ink/alert/sun) reads as trendy and punchy.
- Do NOT invent fake statistics. Only use the FACTS above or clearly generic framings.
- The comment keyword on the cta slide should be short and all-caps.

You will be told what's trending. Recreate those trends as on-brand templates for THIS business — capture the *format and hook style*, not any specific creator's exact words.`;
}

function userPrompt(count: number): string {
  return `First, research what's currently trending on Instagram (and short-form social in general) for LOCAL SERVICE and PET businesses: which carousel FORMATS, HOOKS, and post styles are getting the most reach and saves right now. Look for things like specific hook patterns, "POV" styles, listicle formats, before/after trends, myth-busting, "green flag / red flag", etc.

Then design ${count} NEW carousel templates for DooGoodScoopers that recreate those trending formats — fresh takes we haven't used before. Make them genuinely different from each other.

Return ONLY a JSON object, no prose, in exactly this shape:
{
  "templates": [
    {
      "name": "short catchy name (max 6 words)",
      "description": "one sentence describing the angle",
      "tags": ["trending", "..."],
      "format": "square" | "portrait",
      "trend": "one short sentence naming the trend this recreates (shown to the user)",
      "slides": [ { ...slide as specified... } ]
    }
  ]
}`;
}

// ── Validation / coercion ────────────────────────────────────────────────────
type Raw = Record<string, unknown>;
const asStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

function coerceSlide(raw: Raw): GenSlide | null {
  const layout = asStr(raw.layout);
  if (!LAYOUT_IDS.includes(layout)) return null;
  const def = LAYOUTS[layout as keyof typeof LAYOUTS];

  const fields: Record<string, string | string[] | boolean> = {};
  const rawFields = (raw.fields && typeof raw.fields === "object" ? raw.fields : {}) as Raw;
  for (const f of def.fields) {
    const v = rawFields[f.key];
    if (f.type === "toggle") fields[f.key] = v === true || v === "true";
    else if (f.type === "list")
      fields[f.key] = (Array.isArray(v) ? v.map(asStr) : asStr(v).split("\n"))
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8);
    else fields[f.key] = asStr(v).slice(0, 240);
  }

  const gradId = asStr(raw.gradient);
  const gradient = GRADIENT_IDS.includes(gradId) ? GRADIENTS.find((g) => g.id === gradId)!.css : undefined;
  const textPos = POS_IDS.includes(asStr(raw.textPos)) ? (asStr(raw.textPos) as GenSlide["textPos"]) : undefined;

  return {
    layout: layout as GenSlide["layout"],
    theme: (THEME_IDS.includes(asStr(raw.theme)) ? asStr(raw.theme) : "navy") as GenSlide["theme"],
    font: (FONT_IDS.includes(asStr(raw.font)) ? asStr(raw.font) : "sans") as GenSlide["font"],
    decor: (DECOR_IDS.includes(asStr(raw.decor)) ? asStr(raw.decor) : "paws") as GenSlide["decor"],
    showLogo: raw.showLogo !== false,
    showSwipe: raw.showSwipe !== false,
    ...(textPos ? { textPos } : {}),
    ...(gradient ? { gradient } : {}),
    fields,
  };
}

function coerceTemplate(raw: Raw): GenTemplate | null {
  const name = asStr(raw.name).trim().slice(0, 60);
  if (!name) return null;
  const slides = (Array.isArray(raw.slides) ? raw.slides : [])
    .map((s) => coerceSlide((s ?? {}) as Raw))
    .filter((s): s is GenSlide => s !== null);
  if (slides.length < 2) return null;
  // Guarantee the closing CTA so every template ends on the comment-to-DM ask.
  const last = slides[slides.length - 1];
  if (last.layout !== "cta") {
    const cta = coerceSlide({ layout: "cta", theme: "navy", font: last.font, decor: "paws", showSwipe: false, fields: { kicker: "Ready to hand off the scooping?", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll send the details. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" } });
    if (cta) slides.push(cta);
  } else last.showSwipe = false;

  const tags = Array.isArray(raw.tags) ? raw.tags.map(asStr).map((t) => t.trim()).filter(Boolean).slice(0, 6) : [];
  if (!tags.includes("trending")) tags.unshift("trending");

  return {
    name,
    description: asStr(raw.description).trim().slice(0, 160),
    tags,
    format: asStr(raw.format) === "portrait" ? "portrait" : "square",
    trend: asStr(raw.trend).trim().slice(0, 200),
    slides,
  };
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

// ── Generation ───────────────────────────────────────────────────────────────
async function callModel(anthropic: Anthropic, count: number, useSearch: boolean): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt(),
    ...(useSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }] } : {}),
    messages: [{ role: "user", content: userPrompt(count) }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Ask Claude to research trends and design `count` fresh templates. */
export async function generateTrendTemplates(count = 3): Promise<GenTemplate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const anthropic = new Anthropic({ apiKey });

  let text = "";
  try {
    text = await callModel(anthropic, count, true); // grounded in live web search
  } catch (e) {
    console.warn("[trends] web-search generation failed, retrying without search:", e);
    text = await callModel(anthropic, count, false); // fall back to the model's own knowledge
  }

  const parsed = extractJson(text) as { templates?: unknown[] } | null;
  const rawList = Array.isArray(parsed?.templates) ? parsed!.templates! : Array.isArray(parsed) ? (parsed as unknown[]) : [];
  return rawList
    .map((t) => coerceTemplate((t ?? {}) as Raw))
    .filter((t): t is GenTemplate => t !== null)
    .slice(0, count);
}

// ── Persistence ──────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Save new templates, skipping any whose name already exists (DB or built-in). */
export async function saveTrendTemplates(defs: GenTemplate[]): Promise<number> {
  if (!defs.length) return 0;
  const existing = await prisma.studioTemplate.findMany({ select: { name: true } });
  const seen = new Set<string>([
    ...existing.map((t) => norm(t.name)),
    ...TEMPLATES.map((t) => norm(t.name)),
  ]);

  let added = 0;
  for (const def of defs) {
    const key = norm(def.name);
    if (seen.has(key)) continue;
    seen.add(key);
    await prisma.studioTemplate.create({
      data: {
        name: def.name,
        description: def.description,
        tags: def.tags,
        format: def.format,
        data: def.slides as unknown as object,
        source: "ai",
        trend: def.trend,
      },
    });
    added++;
  }
  return added;
}

/** One-shot: research trends, generate, and persist. Returns how many were added. */
export async function refreshTrendTemplates(count = 3): Promise<{ added: number; generated: number }> {
  const defs = await generateTrendTemplates(count);
  const added = await saveTrendTemplates(defs);
  return { added, generated: defs.length };
}
