import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";

// A canvasser-scoped AI analyst. Same idea as Ask DGS, but every tool is HARD
// scoped to the signed-in rep's own rows (canvasserId), so a canvasser can only
// analyze their own door-to-door data — never anyone else's, and never the wider
// business. No raw SQL is exposed; only two purpose-built, scoped tools.

const MODEL = "claude-sonnet-5";

export function isAskCanvasserConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const STATUS_LABEL: Record<string, string> = {
  NOT_HOME: "Not home", CALLBACK: "Call back", INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested", LEAD: "Lead", DO_NOT_KNOCK: "Do not knock",
};

/** Midnight (start of day) Pacific time, as a Date. */
function ptDayStart(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const wallAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = wallAsUtc - now.getTime();
  const midnightWall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, 0, 0, 0);
  return new Date(midnightWall - offsetMs);
}

async function myStats(canvasserId: string): Promise<unknown> {
  const now = new Date();
  const today = ptDayStart(now);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const scope = { canvasserId };

  const [dispoAll, doorsToday, doorsWeek, doorsAll, aiNoted, leadsToday, leadsWeek, leadsAll, zipsRaw] = await Promise.all([
    prisma.canvassVisit.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.canvassVisit.count({ where: { ...scope, createdAt: { gte: today } } }),
    prisma.canvassVisit.count({ where: { ...scope, createdAt: { gte: week } } }),
    prisma.canvassVisit.count({ where: scope }),
    prisma.canvassVisit.count({ where: { ...scope, aiNotes: { not: null } } }),
    prisma.canvasserLead.count({ where: { ...scope, createdAt: { gte: today } } }),
    prisma.canvasserLead.count({ where: { ...scope, createdAt: { gte: week } } }),
    prisma.canvasserLead.count({ where: scope }),
    prisma.canvassVisit.groupBy({ by: ["zipCode"], where: { ...scope, zipCode: { not: null } }, _count: { _all: true } }),
  ]);

  const byDisposition: Record<string, number> = {};
  for (const d of dispoAll) byDisposition[STATUS_LABEL[d.status] ?? d.status] = d._count._all;
  const topZips = zipsRaw.map((z) => ({ zip: z.zipCode, doors: z._count._all })).sort((a, b) => b.doors - a.doors).slice(0, 8);

  return {
    doors: { today: doorsToday, last7Days: doorsWeek, allTime: doorsAll },
    leads: { today: leadsToday, last7Days: leadsWeek, allTime: leadsAll },
    byDisposition,
    homesWithAiNotes: aiNoted,
    conversionRate: doorsAll ? `${Math.round((leadsAll / doorsAll) * 100)}%` : "n/a",
    topZips,
  };
}

async function searchMyPins(canvasserId: string, opts: { query?: string; status?: string; limit?: number }): Promise<unknown> {
  const take = Math.min(Math.max(opts.limit ?? 25, 1), 60);
  const statusKey = Object.entries(STATUS_LABEL).find(([, v]) => v.toLowerCase() === (opts.status || "").toLowerCase())?.[0] || (opts.status && STATUS_LABEL[opts.status] ? opts.status : undefined);
  const q = (opts.query || "").trim();
  const rows = await prisma.canvassVisit.findMany({
    where: {
      canvasserId,
      ...(statusKey ? { status: statusKey } : {}),
      ...(q ? { OR: [
        { address: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { zipCode: { contains: q } },
        { notes: { contains: q, mode: "insensitive" } },
        { aiNotes: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { address: true, city: true, zipCode: true, status: true, notes: true, aiNotes: true, createdAt: true },
  });
  return {
    matched: rows.length,
    pins: rows.map((r) => ({
      address: r.address, city: r.city, zip: r.zipCode,
      disposition: STATUS_LABEL[r.status] ?? r.status,
      notes: r.notes?.slice(0, 400) || null,
      aiNotes: r.aiNotes?.slice(0, 600) || null,
      date: r.createdAt.toISOString().slice(0, 10),
    })),
  };
}

const TOOLS: Anthropic.Tool[] = [
  { name: "my_stats", description: "Get the canvasser's own totals: doors knocked (today / last 7 days / all time), leads (same windows), a breakdown by disposition, conversion rate, homes with AI notes, and their top ZIP codes by door count. Call this for any 'how am I doing / how many' question.", input_schema: { type: "object", properties: {} } },
  { name: "search_my_pins", description: "Search the canvasser's own dropped pins. Use for questions about specific homes or patterns (e.g. callbacks to follow up, homes that mentioned dogs, interested homes on a street). Filters: query (free text over address/city/zip/notes/AI notes), status (one of: Not home, Call back, Interested, Not interested, Lead, Do not knock), limit.", input_schema: { type: "object", properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } } },
];

export interface AskCanvasserResult { answer: string; }

export async function askCanvasser(canvasserId: string, canvasserName: string, history: { role: "user" | "assistant"; content: string }[]): Promise<AskCanvasserResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: "The AI coach isn't set up yet." };
  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const system = `You are the personal AI canvassing coach for ${canvasserName || "a door-to-door rep"} at DooGoodScoopers, a residential pooper-scooper service. You help them understand and improve THEIR OWN door-to-door canvassing.

Today is ${today}.

RULES
- Only ever discuss this rep's own canvassing data — their dropped pins (doors), dispositions, notes, AI door-notes, and leads. You have no access to anyone else's data or the wider business, and you must not speculate about it.
- Ground every number in the tools. Call my_stats for totals/how-am-I-doing questions; search_my_pins for questions about specific homes or follow-ups. Never invent numbers.
- Be encouraging, practical, and brief — this rep is reading on a phone between doors. Lead with the answer, put key numbers in **bold**, use short bullets. Offer one concrete, actionable tip when it helps (e.g. which callbacks to hit, which ZIP is converting best).
- Stay in scope: canvassing, their pins/leads, follow-ups, territory coverage, and door-to-door technique. If asked about anything outside their canvassing, gently steer back.`;

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 5; i++) {
    const resp = await client.messages.create({ model: MODEL, max_tokens: 1200, system, tools: TOOLS, messages });
    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content as Anthropic.ContentBlockParam[] });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        let content: unknown;
        if (block.name === "my_stats") content = await myStats(canvasserId);
        else if (block.name === "search_my_pins") content = await searchMyPins(canvasserId, (block.input as { query?: string; status?: string; limit?: number }) || {});
        else content = { error: "unknown tool" };
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(content) });
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const answer = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return { answer: answer || "I couldn't put that together — try rephrasing." };
  }
  return { answer: "That took too many steps — try a simpler question." };
}
