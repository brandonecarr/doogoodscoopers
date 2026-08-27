import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { gatherContext } from "@/lib/marketing-director";

// ── Ask DGS ──────────────────────────────────────────────────────────────────
// An on-demand operations analyst for DooGoodScoopers. The owner asks a plain
// question ("how many new leads this week?", "MRR vs last month?") and Claude
// answers from LIVE data using two read-only tools:
//   • business_snapshot — the same numbers the marketing director reasons about
//   • query_database    — one guarded, read-only SELECT over the real Postgres
// Everything is admin-gated (the caller already sees all this data in /admin),
// and the SQL tool is SELECT-only, so there is no write path.

const MODEL = "claude-opus-5";

export function isAskDgsConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Live schema catalog (cached per server process) ──────────────────────────
// Fed to Claude so it always writes SQL against the real table/column names
// (Postgres identifiers are case-sensitive PascalCase and must be quoted).
let schemaCache: { text: string; at: number } | null = null;
async function schemaCatalog(): Promise<string> {
  if (schemaCache && Date.now() - schemaCache.at < 10 * 60 * 1000) return schemaCache.text;
  const rows = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema = 'public' and table_name not like '\\_%'
      order by table_name, ordinal_position`
  );
  const byTable = new Map<string, string[]>();
  for (const r of rows) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
    byTable.get(r.table_name)!.push(`${r.column_name} ${r.data_type}`);
  }
  const text = [...byTable.entries()].map(([t, cols]) => `"${t}"(${cols.join(", ")})`).join("\n");
  schemaCache = { text, at: Date.now() };
  return text;
}

// ── Read-only SQL guard ──────────────────────────────────────────────────────
function safeSelect(sqlRaw: string): string | null {
  let s = sqlRaw.trim().replace(/;+\s*$/, ""); // drop trailing semicolons
  if (s.includes(";")) return null; // no multi-statement
  if (!/^(select|with)\b/i.test(s)) return null; // reads only
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|call|merge|vacuum|refresh|reindex|lock|set|reset|do|prepare|execute|listen|notify|attach|detach)\b/i.test(s)) return null;
  if (/\b(pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_read_server_files)\b/i.test(s)) return null;
  if (!/\blimit\s+\d+/i.test(s)) s += "\nLIMIT 500";
  return s;
}

function jsonSafe(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val));
}

async function runQuery(sql: string): Promise<string> {
  const safe = safeSelect(sql);
  if (!safe) return jsonSafe({ error: "Only a single read-only SELECT/WITH query is allowed." });
  try {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(safe);
    const arr = Array.isArray(rows) ? rows : [rows];
    let out = jsonSafe({ rowCount: arr.length, rows: arr.slice(0, 500) });
    if (out.length > 24000) out = out.slice(0, 24000) + "…(truncated — add aggregation or a tighter LIMIT)";
    return out;
  } catch (e) {
    return jsonSafe({ error: String((e as Error)?.message || e).slice(0, 500) });
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "business_snapshot",
    description:
      "Fast top-line overview of the business: active customers, estimated MRR, last-30-day signups/cancellations/net and website quote submissions, review count & average rating, top cancellation reasons, and top customer ZIP codes. Call this first for any broad 'how are we doing' question before reaching for SQL.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_database",
    description:
      "Run ONE read-only SQL SELECT (or WITH…SELECT) against the live Postgres database and get the rows back as JSON. Use this for anything specific the snapshot doesn't cover (counts by time window, lists of leads/customers, trends by week/month, breakdowns by ZIP/source/status). Postgres identifiers are case-sensitive — you MUST double-quote table and column names exactly as given in the schema, e.g. select count(*) from \"SweepandgoCustomer\" where \"active\" = true. Read-only: no INSERT/UPDATE/DELETE. Always aggregate or LIMIT; never select whole large tables.",
    input_schema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "One short phrase: what this query answers." },
        sql: { type: "string", description: "A single read-only SELECT/WITH query." },
      },
      required: ["sql"],
    },
  },
];

export interface AskStep {
  tool: string;
  purpose?: string;
  sql?: string;
  rowCount?: number;
  error?: string;
}
export interface AskResult {
  answer: string;
  steps: AskStep[];
}

function systemPrompt(catalog: string, today: string): string {
  return `You are "Ask DGS", the operations analyst for DooGoodScoopers, a residential pooper-scooper service in the Inland Empire (Fontana, CA area). You answer the owner's questions about the business using LIVE data, the way a sharp ops/finance lead would.

Today's date is ${today}. All money is USD.

HOW TO ANSWER
- Ground every number in real data. Use the tools — never guess or invent figures. If you state a number, it came from a tool call this turn.
- For broad "how are we doing / overview" questions, call business_snapshot first.
- For anything specific (time windows, lists, trends, breakdowns), use query_database. Write focused SQL that aggregates or LIMITs — never dump whole tables.
- If a query errors, read the error, fix the SQL, and try again (you have a few attempts). If you genuinely cannot get the data, say so plainly.
- Be concise and lead with the answer. Put key figures in **bold**. Use short bullet lists for breakdowns. A couple of sentences of insight is welcome; walls of text are not.
- Do NOT print SQL in your answer — the app shows the queries separately.
- When useful, end with one short, concrete suggestion (e.g. "want this every Monday?") — but only when it genuinely helps.

DOMAIN NOTES
- Active customers = rows in "SweepandgoCustomer" where "active" = true.
- Estimated MRR ≈ sum of "SubscriptionEvent"."revenue" where "kind" = 'SIGNUP' minus where "kind" = 'CANCELLATION'. SubscriptionEvent."kind" is one of SIGNUP / CANCELLATION / QUOTE; "occurredAt" is the timestamp.
- Leads live in several pipelines — inspect the schema: "QuoteLead" (website/quote + Meta/IG), "AdLead", "CanvasserLead" (door-to-door), "OutOfAreaLead". Most lead tables have "status", "createdAt", "source", "zipCode", "archived".
- Reviews are in "Review" ("rating" 1–5). Funnels: "Funnel", "FunnelSession", "FunnelEvent".
- Lifetime revenue per customer comes from "SngInvoice" (mirrored Sweep&Go invoices): sum("paidCents" - "refundedCents") / 100, matched to a customer by "nameKey" = lowercased "firstName" || ' ' || "lastName". Amounts are INTEGER CENTS. "remainingCents" > 0 means still owed.
- "SubscriptionEvent"."excluded" = true marks test signups made while trialling Sweep&Go. ALWAYS add "excluded" = false to signup/cancellation stats, or the numbers are inflated.
- CANVASSERS (door-to-door reps) live in "Canvasser" ("name", "email", "active", "lastLoginAt", "invitedAt"). Their fieldwork:
  · "CanvassVisit" = every door knocked. Join "CanvassVisit"."canvasserId" = "Canvasser"."id" (the column comment says Supabase users.id, but it holds the Canvasser id). Columns: "status" (NOT_HOME | NOT_INTERESTED | CALLBACK | INTERESTED | LEAD | DO_NOT_KNOCK), "notes", "aiNotes" (AI summary of the at-the-door pitch), "address", "zipCode", "lat"/"lng", "createdAt".
  · "CanvasserLead" = doors that became leads ("canvasserId", "canvasserName", "status", "aiNotes", plus normal lead columns).
  · "CanvassTerritory" = assigned areas ("name", "polygon", "homeCount", "assignedCanvasserId", "color").
- Canvasser metrics worth reporting: doors knocked per day/week, contact rate (visits with "status" <> 'NOT_HOME' ÷ all visits), lead rate (visits with "status" = 'LEAD' ÷ visits), leads per 100 doors, territory coverage (visits inside their territory ÷ that territory's "homeCount"), days active / recency, and how many of their leads converted. When asked about ONE rep, match "Canvasser"."name" ILIKE '%name%' and cover BOTH activity (volume, recency) and quality (contact rate, conversion, whether notes are being written).
- Postgres identifiers are case-sensitive: ALWAYS double-quote table and column names exactly as in the schema below. Use now() and intervals for dates, e.g. "createdAt" >= now() - interval '7 days'.

DATABASE SCHEMA (public tables — name(columns)):
${catalog}`;
}

export async function askDgs(history: { role: "user" | "assistant"; content: string }[]): Promise<AskResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: "Ask DGS isn't configured yet (missing ANTHROPIC_API_KEY).", steps: [] };
  const client = new Anthropic({ apiKey });
  const catalog = await schemaCatalog();
  const today = new Date().toISOString().slice(0, 10);
  const system = systemPrompt(catalog, today);

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const steps: AskStep[] = [];

  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create({ model: MODEL, max_tokens: 2000, system, tools: TOOLS, messages });

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content as Anthropic.ContentBlockParam[] });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        let content = "";
        if (block.name === "business_snapshot") {
          content = jsonSafe(await gatherContext());
          steps.push({ tool: "business_snapshot" });
        } else if (block.name === "query_database") {
          const input = block.input as { sql?: string; purpose?: string };
          const sql = String(input?.sql || "");
          content = await runQuery(sql);
          let rowCount: number | undefined;
          let error: string | undefined;
          try {
            const parsed = JSON.parse(content);
            rowCount = parsed.rowCount;
            error = parsed.error;
          } catch { /* ignore */ }
          steps.push({ tool: "query_database", purpose: input?.purpose, sql, rowCount, error });
        } else {
          content = jsonSafe({ error: `Unknown tool ${block.name}` });
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    const answer = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { answer: answer || "I couldn't put together an answer for that.", steps };
  }

  return { answer: "That question took too many steps to resolve — try narrowing it down.", steps };
}
