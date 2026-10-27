/**
 * Sona playbooks — the branching "if they say this, do that" script for an
 * outbound Sona call, per lead type.
 *
 * Quo gives outbound Sona exactly one input: a plain-text instruction of up to
 * 2,000 characters. So the branching lives in the wording. This module holds the
 * structured form the owner edits (/admin/sona-playbooks), the built-in defaults,
 * and `compilePlaybook`, which turns a playbook into that instruction. Shared by
 * the server (lib/sona-calls → defaultSonaTask) and the editor's live preview.
 *
 * Stored as JSON in AppSetting `sona.playbook.<LEAD_TYPE>`.
 */

export interface SonaBranch { when: string; then: string }
export interface SonaPlaybook {
  /** Who Sona is and why it's calling. Tokens allowed. */
  opening: string;
  /** What a successful call achieves. */
  goal: string;
  /** Things to find out, in order. */
  collect: string[];
  /** "If the lead says/asks…" → "Sona should…". Checked in order. */
  branches: SonaBranch[];
  /** Facts Sona may share when asked. */
  facts: string[];
  /** Hard rules. */
  never: string[];
  /** How to end the call. */
  wrapUp: string;
}

export const SONA_MAX_TASK = 2000;
export const SONA_LEAD_TYPES = ["QUOTE_FORM", "AD_LEAD", "COMMERCIAL", "OUT_OF_AREA"] as const;
export type SonaPlaybookLeadType = (typeof SONA_LEAD_TYPES)[number];
export const SONA_LEAD_TYPE_LABEL: Record<SonaPlaybookLeadType, string> = { QUOTE_FORM: "Website quote leads", AD_LEAD: "Ad leads", COMMERCIAL: "Commercial inquiries", OUT_OF_AREA: "Out-of-area leads" };

/** Tokens the owner can use anywhere in a playbook. Filled from the lead at call time. */
export const SONA_TOKENS: Array<{ token: string; means: string }> = [
  { token: "{{firstName}}", means: "lead's first name" },
  { token: "{{name}}", means: "full name" },
  { token: "{{city}}", means: "city" },
  { token: "{{zipCode}}", means: "zip" },
  { token: "{{dogs}}", means: "\"2 dogs\"" },
  { token: "{{frequency}}", means: "\"Weekly\"" },
  { token: "{{monthlyRate}}", means: "\"$89\"" },
  { token: "{{quoteDetails}}", means: "\"2 dogs, weekly service in Fontana 92336\"" },
  { token: "{{rateSentence}}", means: "\" Their quoted rate is $89 per month.\" or blank" },
];

const SHARED_FACTS = [
  "No contracts; cancel any time",
  "First visit is an initial cleanup priced after we see the yard",
  "Card on file is billed on the 1st",
  "We text when on the way and send a gate photo when done",
  "A sanitizing spray can be added to any visit",
  "Questions: (909) 366-3744",
];
const SHARED_NEVER = [
  "Never book a date or time; Brandon or Valerie will confirm the first visit",
  "Never quote a price not in these notes",
  "Never argue or pressure; keep it under three minutes",
];
const SHARED_BRANCHES: SonaBranch[] = [
  { when: "they already signed up", then: "Thank them and end the call." },
  { when: "they're not interested or ask not to be called", then: "Apologize, thank them, end the call." },
  { when: "they ask what the first visit costs", then: "It's priced after we see the yard since it depends on how long it's been; the monthly rate stays the same after." },
  { when: "they ask about insurance or dog safety", then: "We're insured, we disinfect tools and shoes between homes, and friendly dogs can stay out." },
  { when: "they want a person", then: "Say Brandon or Valerie will call back, ask the best time, end the call." },
  { when: "they ask something not covered here", then: "Say Brandon or Valerie will follow up, note it, move on." },
];

export const DEFAULT_SONA_PLAYBOOKS: Record<SonaPlaybookLeadType, SonaPlaybook> = {
  QUOTE_FORM: {
    opening: "You are Sona, calling {{firstName}} for DooGoodScoopers, a dog waste removal service in the Inland Empire and High Desert. They requested a quote on our website for {{quoteDetails}} but haven't scheduled.{{rateSentence}}",
    goal: "Find out whether they'd like to get started, answer questions, and collect what we need to schedule the first visit.",
    collect: ["If they want to start", "Best day of the week", "Yard access (gate, locked?)", "Dogs put away?"],
    branches: [
      { when: "they say yes", then: "Collect the day and yard access, then say Brandon or Valerie will text to confirm the first visit." },
      { when: "they're still deciding", then: "Ask what would help, answer from the facts, offer to text their saved quote link." },
      { when: "they ask about price", then: "Repeat their monthly rate, explain the one-time initial cleanup, and that there's no contract." },
      ...SHARED_BRANCHES,
    ],
    facts: SHARED_FACTS,
    never: SHARED_NEVER,
    wrapUp: "Repeat what you collected in one sentence, thank them by name, end the call.",
  },
  AD_LEAD: {
    opening: "You are Sona, calling {{firstName}} for DooGoodScoopers, a dog waste removal service in the Inland Empire and High Desert. They responded to one of our ads{{whereClause}}.",
    goal: "Learn what they need, answer questions, and if interested, collect what we need to schedule a first visit.",
    collect: ["How many dogs", "How often (weekly, twice a week, every other week, one time)", "Zip code", "Best day of the week", "Yard access"],
    branches: [
      { when: "they're interested", then: "Collect the items above, then say Brandon or Valerie will text a price and confirm the first visit." },
      { when: "they ask about price", then: "It depends on dogs and frequency; most weekly customers pay $70 to $120 a month; we'll text an exact quote." },
      { when: "they don't remember the ad", then: "Briefly say who we are and offer a quote; if no, thank them and end." },
      ...SHARED_BRANCHES,
    ],
    facts: SHARED_FACTS,
    never: SHARED_NEVER,
    wrapUp: "Repeat what you collected in one sentence, thank them by name, end the call.",
  },
  COMMERCIAL: {
    opening: "You are Sona, calling {{firstName}} for DooGoodScoopers, a commercial pet waste removal service for HOAs, apartments and parks in the Inland Empire and High Desert. They inquired about service for their property.",
    goal: "Understand the property and needs so Brandon can send a written proposal.",
    collect: ["Property type and name", "Address or city", "Number of pet stations or common areas", "How often they'd like service", "Decision maker and email"],
    branches: [
      { when: "they ask for a price", then: "Commercial pricing is quoted per property after a walk-through or photos; Brandon sends a proposal within two business days." },
      { when: "they want to schedule the walk-through", then: "Collect two or three days and times; Brandon will confirm one." },
      ...SHARED_BRANCHES.slice(0, 2), SHARED_BRANCHES[4], SHARED_BRANCHES[5],
    ],
    facts: ["We service HOAs, apartments, parks and dog parks on a set schedule", "Stations restocked with bags and common areas cleaned", "Questions: (909) 366-3744"],
    never: SHARED_NEVER,
    wrapUp: "Repeat the property details, say Brandon will follow up by email, thank them, end the call.",
  },
  OUT_OF_AREA: {
    opening: "You are Sona, calling {{firstName}} for DooGoodScoopers, a dog waste removal service. They asked about service in {{city}} {{zipCode}}, outside our current route.",
    goal: "Let them know where we stand on their area and keep the door open.",
    collect: ["Whether they'd like to hear when we reach their area", "How many dogs and how often"],
    branches: [
      { when: "they ask when we'll reach their area", then: "We're expanding and can't promise a date, but we'll reach out as soon as we do." },
      ...SHARED_BRANCHES.slice(1, 2), SHARED_BRANCHES[4], SHARED_BRANCHES[5],
    ],
    facts: SHARED_FACTS,
    never: SHARED_NEVER,
    wrapUp: "Thank them for their interest and end the call.",
  },
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const endDot = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** Turn a playbook into the one instruction Sona receives. Tokens are left for the caller to fill. */
export function compilePlaybook(p: SonaPlaybook): string {
  const parts: string[] = [];
  if (clean(p.opening)) parts.push(endDot(clean(p.opening)));
  if (clean(p.goal)) parts.push(`Goal: ${endDot(clean(p.goal))}`);
  const collect = p.collect.map(clean).filter(Boolean);
  if (collect.length) parts.push(`Find out: ${collect.join("; ")}.`);
  const branches = p.branches.filter((b) => clean(b.when) && clean(b.then));
  if (branches.length) parts.push(branches.map((b) => `If ${clean(b.when).replace(/^if\s+/i, "").replace(/[.]$/, "")}: ${endDot(clean(b.then))}`).join(" "));
  const facts = p.facts.map(clean).filter(Boolean);
  if (facts.length) parts.push(`Facts you may share: ${facts.map((f) => f.replace(/[.]$/, "")).join("; ")}.`);
  const never = p.never.map(clean).filter(Boolean);
  if (never.length) parts.push(`Rules: ${never.map((f) => f.replace(/[.]$/, "")).join("; ")}.`);
  if (clean(p.wrapUp)) parts.push(`To end: ${endDot(clean(p.wrapUp))}`);
  return parts.join(" ");
}

/** Parse a stored playbook, tolerating missing fields. Null if it isn't one. */
export function parsePlaybook(raw: string | null | undefined): SonaPlaybook | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<SonaPlaybook>;
    if (!j || typeof j !== "object") return null;
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);
    return {
      opening: String(j.opening ?? ""), goal: String(j.goal ?? ""), collect: arr(j.collect),
      branches: Array.isArray(j.branches) ? j.branches.map((b) => ({ when: String((b as SonaBranch)?.when ?? ""), then: String((b as SonaBranch)?.then ?? "") })) : [],
      facts: arr(j.facts), never: arr(j.never), wrapUp: String(j.wrapUp ?? ""),
    };
  } catch { return null; }
}

/** Fill {{tokens}} and drop any that stay empty, then tidy spacing. */
export function fillTokens(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v);
  return out.replace(/\{\{\s*[a-zA-Z]+\s*\}\}/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\.{2,}/g, ".").replace(/[ ]{2,}/g, " ").trim();
}
