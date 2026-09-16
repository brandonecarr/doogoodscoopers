import { getPageAccessToken } from "@/lib/facebook-connect";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * A Lead Ads webhook only carries the leadgen id. Fetch the real answers with the
 * Page token, then flatten field_data ([{name, values:[…]}]) into a plain object.
 */
export async function fetchLeadgen(leadgenId: string): Promise<Record<string, string> | null> {
  const token = await getPageAccessToken();
  if (!token) return null;
  const fields = "field_data,ad_name,campaign_name,adset_name,form_name,created_time,platform,ad_id,campaign_id,adset_id,form_id";
  const res = await fetch(`${GRAPH}/${encodeURIComponent(leadgenId)}?fields=${fields}&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
  const d = (await res.json().catch(() => ({}))) as { field_data?: { name: string; values: string[] }[]; error?: { message?: string } } & Record<string, unknown>;
  if (!res.ok || d.error) { console.error("[leadgen] fetch failed:", d.error?.message || res.status); return null; }
  const out: Record<string, string> = {};
  for (const k of ["ad_name", "campaign_name", "adset_name", "form_name", "created_time", "platform", "ad_id", "campaign_id", "adset_id", "form_id"]) {
    if (typeof d[k] === "string") out[k] = d[k] as string;
  }
  for (const f of d.field_data || []) {
    const val = (f.values || []).join(", ").trim();
    if (val) out[f.name.trim().toLowerCase().replace(/\s+/g, "_")] = val;
  }
  return out;
}
