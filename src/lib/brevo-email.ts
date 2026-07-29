/**
 * Brevo (Sendinblue) transactional email — the app's email sender.
 *
 * Uses the transactional SMTP API (POST /v3/smtp/email) with the account's
 * API key. The sender email MUST be a verified sender in Brevo
 * (Settings → Senders); an unverified address is rejected. Our verified
 * sender is service@doogoodscoopers.com.
 */

const API = "https://api.brevo.com/v3/smtp/email";

export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
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
  const key = process.env.BREVO_API_KEY;
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
