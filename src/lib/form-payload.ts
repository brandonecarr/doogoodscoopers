import type { NextRequest } from "next/server";

/**
 * Loose reader for website-form webhooks.
 *
 * WordPress form plugins all shape their payloads differently — Elementor posts
 * urlencoded `form_fields[name]`, WPForms nests `{ fields: { "1": { name, value } } }`,
 * Contact Form 7 uses `your-name`. Rather than teach every route each shape, this
 * flattens the body and matches fields by loosely-normalised KEY, so a route can
 * say "give me whatever looks like a phone number" and get it regardless of plugin.
 * Shared by the careers and commercial intake routes.
 */

export type Flat = Record<string, string>;

/** Flatten one level of nesting and stringify every leaf. */
export function flatten(input: unknown, prefix = "", out: Flat = {}): Flat {
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (typeof o.value === "string" || typeof o.value === "number") {
        out[String(o.name ?? o.label ?? key)] = String(o.value);
      } else {
        flatten(v, key, out);
      }
    } else if (Array.isArray(v)) {
      out[key] = v.map((x) => String(x)).join(", ");
    } else if (v !== null && v !== undefined) {
      out[key] = String(v);
    }
  }
  return out;
}

const norm = (x: string) => x.toLowerCase().replace(/[\s_-]+/g, "");

/**
 * Every way a key might reasonably be written, so anchored patterns still work.
 * `form_fields[name]` -> "name", `a.b.city` -> "city", `property_name` -> "propertyname".
 */
export function keyForms(k: string): string[] {
  const forms = [norm(k)];
  const bracket = k.match(/\[([^\]]+)\]\s*$/);
  if (bracket) forms.push(norm(bracket[1]));
  const leaf = k.split(".").pop();
  if (leaf && leaf !== k) forms.push(norm(leaf));
  return forms;
}

/** First non-empty value whose KEY loosely matches any pattern; each key used once. */
export function makePicker(flat: Flat) {
  const used = new Set<string>();
  const pick = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      for (const [k, v] of Object.entries(flat)) {
        if (!String(v).trim() || used.has(k)) continue;
        if (keyForms(k).some((form) => p.test(form))) { used.add(k); return String(v).trim(); }
      }
    }
    return "";
  };
  return { pick, used };
}

export const yes = (v: string) => /^(1|y|yes|true|on|checked)$/i.test(v.trim());

/** Read JSON, urlencoded, or multipart — whichever the sender used. Throws on garbage. */
export async function readPayload(request: NextRequest | Request): Promise<unknown> {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) return request.json();
  const fd = await request.formData();
  const o: Record<string, string> = {};
  fd.forEach((v, k) => { o[k] = typeof v === "string" ? v : v.name; });
  return o;
}

/**
 * Optional shared secret, accepted as `Authorization: Bearer` OR `?key=` because
 * many WP form plugins cannot set headers. Returns true when the request may proceed.
 */
export function secretOk(request: NextRequest | Request, secret: string | undefined): boolean {
  if (!secret) return true;
  const header = request.headers.get("authorization")?.replace("Bearer ", "");
  const qs = new URL(request.url).searchParams.get("key");
  return header === secret || qs === secret;
}
