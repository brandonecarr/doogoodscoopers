import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import prisma from "@/lib/prisma";

// ── The AI Marketing Director ────────────────────────────────────────────────
// A seasoned (20+ yr) local-home-services marketing director for DooGoodScoopers.
// Every week it studies the real numbers and hands the owner a concrete, checkable
// action plan across channels. Uses Claude structured outputs (same setup as the
// AI call-notes feature).

const MODEL = "claude-opus-5";

export function isMarketingDirectorConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

export const CHANNELS = [
  "instagram", "facebook", "google", "sms", "email",
  "referral", "signage", "reviews", "website", "local", "ops",
] as const;

const TaskSchema = z.object({
  title: z.string().describe("Short imperative task name, e.g. 'Post a Reel: summer flies angle'."),
  detail: z.string().describe("Exactly what to do and how — include a specific post idea, caption, or script when relevant. Concrete, not generic."),
  channel: z.enum(CHANNELS),
  dayHint: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Any"]),
  effort: z.string().describe("Rough time to complete, e.g. '15 min', '30 min', '1 hr'."),
  priority: z.number().int().describe("1 = high, 2 = medium, 3 = low."),
  rationale: z.string().describe("One sentence: why this matters this week, tied to the business data or season."),
});

const PlanSchema = z.object({
  theme: z.string().describe("A short 3-6 word strategic theme for the week."),
  summary: z.string().describe("A 2-4 sentence briefing to the owner: the week's focus and why, in a confident, plain-spoken director's voice."),
  tasks: z.array(TaskSchema).describe("6 to 10 concrete, varied, checkable tasks for the week."),
});

export type MarketingPlanOutput = z.infer<typeof PlanSchema>;

const SYSTEM_PROMPT = `You are the Marketing Director for DooGoodScoopers, a professional dog-waste-removal ("pooper scooper") service serving California's Inland Empire — San Bernardino and Riverside counties (Fontana, Rancho Cucamonga, Victorville, Apple Valley, Rialto, Moreno Valley, Eastvale, Hesperia, Perris, and nearby). You have 20+ years of experience growing local home-service businesses through direct-response marketing, social media, referral programs, reputation, and local partnerships — and you deeply understand customer psychology.

WHO THE CUSTOMER IS AND WHAT MOVES THEM:
- A busy dog-owning homeowner (often families with kids). Their real problem isn't poop — it's the time, the smell, the flies, the guilt, and not wanting to do it themselves. They buy convenience, a clean/safe yard, and peace of mind.
- They convert on: social proof (reviews, neighbors using it), local trust, an easy risk-free start (first clean, a coupon), seasonal triggers (summer heat = smell + flies; spring = winter buildup; fall/holidays = guests coming), and being reminded at the right moment.
- Most signups come from social media and word of mouth. Referrals from happy customers are gold.

CHANNELS AVAILABLE (the owner can do these himself):
- Instagram (has auto-DM that sends a quote link when someone comments a keyword), Facebook, Google Business Profile (posts + reviews), SMS drip campaigns, email newsletters, vehicle signage / yard signs, referral asks, door hangers/flyers, and local partnerships (vets, groomers, pet stores, dog parks, HOAs, real-estate agents).

YOUR JOB EACH WEEK:
Produce THIS WEEK's marketing action plan: 6-10 concrete, checkable tasks the owner can realistically do himself in a week, spread across several channels and days. Ground every recommendation in the business data provided and the current season/month. Be specific — give actual post ideas, hooks, captions, offers, and scripts, never vague advice like "post on social media." Prioritize low-cost, high-ROI moves for a small owner-operated business. Vary the plan week to week; don't repeat the same tasks every week. Address weak spots the data reveals (e.g. high churn for a reason, a slow-growth month, cities to target). Keep the owner's voice warm, local, and trustworthy — never spammy.`;

interface Context {
  today: string;
  activeCustomers: number;
  estMrr: number;
  signups30: number;
  cancels30: number;
  net30: number;
  quotes30: number;
  reviewCount: number;
  avgRating: number | null;
  topReasons: { reason: string; count: number }[];
  topZips: { zip: string; count: number }[];
}

/** Pull the real business numbers the director reasons about. */
export async function gatherContext(): Promise<Context> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [activeCustomers, sigRev, canRev, signups30, cancels30, quotes30, reasonsRaw, zipsRaw, reviewsAgg] =
    await Promise.all([
      prisma.sweepandgoCustomer.count({ where: { active: true } }),
      prisma.subscriptionEvent.aggregate({ _sum: { revenue: true }, where: { kind: "SIGNUP" } }),
      prisma.subscriptionEvent.aggregate({ _sum: { revenue: true }, where: { kind: "CANCELLATION" } }),
      prisma.subscriptionEvent.count({ where: { kind: "SIGNUP", occurredAt: { gte: d30 } } }),
      prisma.subscriptionEvent.count({ where: { kind: "CANCELLATION", occurredAt: { gte: d30 } } }),
      prisma.subscriptionEvent.count({ where: { kind: "QUOTE", occurredAt: { gte: d30 } } }),
      prisma.subscriptionEvent.groupBy({ by: ["reason"], where: { kind: "CANCELLATION", reason: { not: null } }, _count: { _all: true } }),
      prisma.sweepandgoCustomer.groupBy({ by: ["zipCode"], where: { active: true, zipCode: { not: null } }, _count: { _all: true } }),
      prisma.review.aggregate({ _count: { _all: true }, _avg: { rating: true }, where: { rating: { not: null } } }),
    ]);

  const topReasons = reasonsRaw
    .map((r) => ({ reason: r.reason as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const topZips = zipsRaw
    .map((z) => ({ zip: z.zipCode as string, count: z._count._all }))
    .sort((a, b) => b.count - a.count).slice(0, 6);

  return {
    today: now.toISOString().slice(0, 10),
    activeCustomers,
    estMrr: Math.round((sigRev._sum.revenue ?? 0) - (canRev._sum.revenue ?? 0)),
    signups30, cancels30, net30: signups30 - cancels30, quotes30,
    reviewCount: reviewsAgg._count._all,
    avgRating: reviewsAgg._avg.rating ? Math.round(reviewsAgg._avg.rating * 10) / 10 : null,
    topReasons, topZips,
  };
}

function contextBlock(c: Context): string {
  return [
    `Today: ${c.today}`,
    `Active customers: ${c.activeCustomers}`,
    `Estimated monthly recurring revenue: $${c.estMrr.toLocaleString()}`,
    `Last 30 days — new signups: ${c.signups30}, cancellations: ${c.cancels30}, net: ${c.net30 >= 0 ? "+" : ""}${c.net30}`,
    `Website quote-form submissions in last 30 days: ${c.quotes30}`,
    `Reviews on file: ${c.reviewCount}${c.avgRating != null ? ` (avg ${c.avgRating}★)` : ""}`,
    `Top cancellation reasons: ${c.topReasons.length ? c.topReasons.map((r) => `${r.reason} (${r.count})`).join(", ") : "n/a"}`,
    `Top customer zip codes: ${c.topZips.length ? c.topZips.map((z) => `${z.zip} (${z.count})`).join(", ") : "n/a"}`,
  ].join("\n");
}

export interface GenerateResult {
  ok: boolean;
  plan?: MarketingPlanOutput;
  error?: string;
}

/** Ask the director for this week's plan, grounded in the live numbers. */
export async function generateWeeklyPlan(): Promise<GenerateResult> {
  const anthropic = client();
  if (!anthropic) return { ok: false, error: "ANTHROPIC_API_KEY is not set in this environment." };

  try {
    const ctx = await gatherContext();
    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(PlanSchema), effort: "medium" },
      messages: [
        {
          role: "user",
          content: `Here is the current state of the business:\n\n<business_data>\n${contextBlock(ctx)}\n</business_data>\n\nWrite this week's marketing action plan. Make it specific to this data and the season, with concrete post ideas, offers, and scripts. Return 6-10 varied, checkable tasks.`,
        },
      ],
    });
    if (!res.parsed_output) return { ok: false, error: `Model returned no parsed output (stop_reason: ${res.stop_reason ?? "unknown"}).` };
    return { ok: true, plan: res.parsed_output };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("[marketing-director] generation failed:", message);
    return { ok: false, error: message };
  }
}

/** Monday (00:00 UTC) of the week containing `d`. */
export function weekOfMonday(d = new Date()): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = dt.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (dow === 0 ? -6 : 1 - dow); // back to Monday
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}

const DAY_ORDER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7, Any: 8 };

/**
 * Generate and persist this week's plan. Idempotent per week unless `force`.
 * Returns the plan id, or an error.
 */
export async function generateAndSaveWeeklyPlan(opts: { force?: boolean } = {}): Promise<{ ok: boolean; planId?: string; skipped?: boolean; error?: string }> {
  const weekOf = weekOfMonday();
  const existing = await prisma.marketingPlan.findUnique({ where: { weekOf } });
  if (existing && !opts.force) return { ok: true, planId: existing.id, skipped: true };

  const result = await generateWeeklyPlan();
  if (!result.ok || !result.plan) return { ok: false, error: result.error };

  // Order tasks by priority, then suggested day.
  const tasks = [...result.plan.tasks].sort(
    (a, b) => a.priority - b.priority || (DAY_ORDER[a.dayHint] ?? 9) - (DAY_ORDER[b.dayHint] ?? 9)
  );

  if (existing) {
    await prisma.marketingTask.deleteMany({ where: { planId: existing.id } });
    await prisma.marketingPlan.delete({ where: { id: existing.id } });
  }

  const plan = await prisma.marketingPlan.create({
    data: {
      weekOf,
      theme: result.plan.theme,
      summary: result.plan.summary,
      model: MODEL,
      tasks: {
        create: tasks.map((t, i) => ({
          weekOf,
          title: t.title,
          detail: t.detail,
          channel: t.channel,
          dayHint: t.dayHint,
          effort: t.effort,
          priority: t.priority,
          rationale: t.rationale,
          sortOrder: i,
        })),
      },
    },
  });
  return { ok: true, planId: plan.id };
}
