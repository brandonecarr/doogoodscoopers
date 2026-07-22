import { Resend } from "resend";
import { renderTemplate } from "@/lib/resend";
import { unsubToken } from "@/lib/email-unsubscribe";

const apiKey = process.env.RESEND_API_KEY;
const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL || "DooGoodScoopers <noreply@doogoodscoopers.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.com";
// Physical mailing address is required by CAN-SPAM.
const ADDRESS = process.env.MAIL_FOOTER_ADDRESS || "DooGoodScoopers, Fontana, CA";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}
export function isEmailConfigured(): boolean {
  return !!apiKey;
}

/** Wrap a body in a minimal responsive shell + compliant footer. */
export function wrapNewsletter(bodyHtml: string, unsubUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">${bodyHtml}</div>
  <div style="max-width:600px;margin:0 auto;padding:20px;text-align:center;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">
    <p style="margin:0 0 6px;">${ADDRESS}</p>
    <p style="margin:0;">You received this because you're a DooGoodScoopers contact. <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a>.</p>
  </div>
</body></html>`;
}

export interface CampaignFrom { fromName?: string | null; fromEmail?: string | null; replyTo?: string | null }
export interface OutRecipient { id: string; email: string; name: string | null }
export interface SendResult { id: string; resendId: string | null; error: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBatchIds(res: any): (string | null)[] {
  const d = res?.data;
  const list = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  return list.map((x: { id?: string }) => x?.id ?? null);
}

/** Send one Resend batch (≤100). Returns per-recipient Resend ids (aligned by index). */
export async function sendCampaignBatch(opts: {
  subject: string;
  html: string;
  from: CampaignFrom;
  recipients: OutRecipient[];
}): Promise<SendResult[]> {
  const c = getClient();
  const fromAddr = opts.from.fromEmail ? `${opts.from.fromName || "DooGoodScoopers"} <${opts.from.fromEmail}>` : FROM_DEFAULT;

  const payloads = opts.recipients.map((r) => {
    const firstName = (r.name || "").trim().split(/\s+/)[0] || "";
    const unsubUrl = `${SITE}/unsubscribe?token=${unsubToken(r.email)}`;
    const oneClick = `${SITE}/api/email/unsubscribe?token=${unsubToken(r.email)}`;
    const body = renderTemplate(opts.html, { firstName, name: r.name || "" });
    return {
      from: fromAddr,
      to: [r.email],
      subject: opts.subject,
      html: wrapNewsletter(body, unsubUrl),
      ...(opts.from.replyTo ? { replyTo: opts.from.replyTo } : {}),
      headers: {
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  if (!c) return opts.recipients.map((r) => ({ id: r.id, resendId: null, error: "Resend not configured" }));

  try {
    const res = await c.batch.send(payloads);
    const ids = extractBatchIds(res);
    return opts.recipients.map((r, i) => ({ id: r.id, resendId: ids[i] ?? null, error: ids[i] ? null : "no id returned" }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    return opts.recipients.map((r) => ({ id: r.id, resendId: null, error: msg }));
  }
}
