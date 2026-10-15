/**
 * Hosted "view in browser" copies of sent emails.
 *
 * A link is signed so only the recipient's own copy opens:
 *   /email/view/r/<EmailRecipient id>?s=<sig>                 a blast, personalized for that recipient
 *   /email/view/s/<CampaignStep id>/<leadType>/<leadId>?s=…  a drip email, personalized for that lead
 * The signature is an HMAC over the path parts with the unsubscribe secret.
 */

import crypto from "crypto";

const SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "dgs-email-unsub";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.vercel.app";

export type ViewKind = "r" | "s";

export function viewSignature(kind: ViewKind, parts: string[]): string {
  return crypto.createHmac("sha256", SECRET).update([kind, ...parts].join("/")).digest("base64url").slice(0, 20);
}

export function viewUrl(kind: ViewKind, parts: string[]): string {
  return `${SITE}/email/view/${kind}/${parts.map(encodeURIComponent).join("/")}?s=${viewSignature(kind, parts)}`;
}

export function verifyViewSignature(kind: string, parts: string[], sig: string | null): kind is ViewKind {
  if ((kind !== "r" && kind !== "s") || !sig) return false;
  const expected = viewSignature(kind, parts);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
