/**
 * Brevo (Sendinblue) transactional email — the app's email sender.
 *
 * Uses the transactional SMTP API (POST /v3/smtp/email) with the account's
 * API key. The sender email MUST be a verified sender in Brevo
 * (Settings → Senders); an unverified address is rejected. Our verified
 * sender is service@doogoodscoopers.com.
 */

const API = "https://api.brevo.com/v3/smtp/email";

/** Read the key, tolerating a trailing newline or wrapping quotes from a paste. */
function apiKey(): string {
  return (process.env.BREVO_API_KEY || "").trim().replace(/^["']|["']$/g, "");
}

export function isBrevoConfigured(): boolean {
  return !!apiKey();
}

export interface Addr {
  name?: string;
  email: string;
}

/** Turn a "Name <email>" string (or a bare address) into Brevo's sender shape. */
export function parseAddr(input: string): Addr {
  const m = input.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: input.trim() };
}

export interface BrevoSendInput {
  from: Addr;
  to: Addr[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface BrevoSendResult {
  messageId?: string;
  error?: string;
}

/** Send a single transactional email. One call per message. */
export async function brevoSend(input: BrevoSendInput): Promise<BrevoSendResult> {
  const key = apiKey();
  if (!key) return { error: "Brevo not configured" };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: input.from,
        to: input.to,
        subject: input.subject,
        htmlContent: input.html,
        ...(input.text ? { textContent: input.text } : {}),
        ...(input.replyTo ? { replyTo: parseAddr(input.replyTo) } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data?.message || data?.code || `Brevo error ${res.status}` };
    }
    return { messageId: data?.messageId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "send failed" };
  }
}

export interface BrevoEvent {
  email: string;
  date?: string;
  event: string; // requests | delivered | opened | uniqueOpened | clicks | softBounces | hardBounces | blocked | invalid | unsubscribed | spam | error | ...
  reason?: string;
  link?: string;
  messageId?: string;
}

/** A transactional messageId can be stored with or without <angle brackets>. */
function messageIdVariants(id: string): string[] {
  const stripped = id.replace(/^<|>$/g, "");
  return [...new Set([id, stripped, `<${stripped}>`])];
}

/**
 * Pull the transactional events Brevo recorded for a single sent message
 * (opens, clicks, bounces, unsubscribes…). Used to back-fill stats for a blast
 * that was sent before the event webhook was in place. Returns [] on any error.
 */
export async function fetchBrevoEvents(messageId: string): Promise<BrevoEvent[]> {
  const key = apiKey();
  if (!key || !messageId) return [];
  for (const id of messageIdVariants(messageId)) {
    try {
      const url = `https://api.brevo.com/v3/smtp/statistics/events?limit=100&messageId=${encodeURIComponent(id)}`;
      const res = await fetch(url, { headers: { "api-key": key, accept: "application/json" } });
      if (!res.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json().catch(() => ({}));
      const events: BrevoEvent[] = Array.isArray(data?.events) ? data.events : [];
      if (events.length) return events;
    } catch {
      // try the next id variant
    }
  }
  return [];
}

/** Classify any Brevo event string into the engagement bucket we track. */
export function classifyBrevoEvent(event: string): "open" | "click" | "bounce" | "unsub" | "delivered" | null {
  const e = event.toLowerCase();
  if (/click/.test(e)) return "click";
  if (/open/.test(e)) return "open";
  if (/bounce|blocked|invalid|error/.test(e)) return "bounce";
  if (/unsub|spam|complaint/.test(e)) return "unsub";
  if (/deliver/.test(e)) return "delivered";
  return null;
}

/** Map over items with a bounded number of in-flight requests. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
