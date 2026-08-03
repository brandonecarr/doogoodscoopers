import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Read-only diagnostic for the Instagram webhook wiring. Admin-only.
 * Asks Meta directly: is the token valid, what account is it, and — the usual
 * culprit — is this IG account actually SUBSCRIBED to the app for `comments`?
 * Tokens are never returned; only presence/length and Meta's answers.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Open ...?subscribe=1 to also subscribe this account to `comments` before checking.
  const doSubscribe = new URL(request.url).searchParams.get("subscribe") === "1";

  const token = process.env.IG_PAGE_TOKEN || "";
  const accountId = process.env.IG_ACCOUNT_ID || "";
  const out: Record<string, unknown> = {
    env: {
      IG_ACCOUNT_ID: accountId ? `present (len ${accountId.length})` : "MISSING",
      IG_PAGE_TOKEN: token ? `present (len ${token.length})` : "MISSING",
      IG_VERIFY_TOKEN: process.env.IG_VERIFY_TOKEN ? "present" : "MISSING",
      META_APP_SECRET: process.env.META_APP_SECRET ? "present" : "MISSING",
    },
  };

  if (!token || !accountId) {
    out.hint = "IG_PAGE_TOKEN or IG_ACCOUNT_ID missing from this deployment's env.";
    return NextResponse.json(out);
  }

  async function graph(path: string) {
    try {
      const res = await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    } catch (e) {
      return { status: 0, json: { error: e instanceof Error ? e.message : "fetch failed" } };
    }
  }

  // 1) Who is this account / is the token valid?
  out.account = await graph(`${encodeURIComponent(accountId)}?fields=id,username,name,account_type,followers_count`);

  // Optional one-click fix: subscribe this account to `comments`.
  if (doSubscribe) {
    try {
      const res = await fetch(
        `${GRAPH}/${encodeURIComponent(accountId)}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      out.subscribe_attempt = { status: res.status, json: await res.json().catch(() => ({})) };
    } catch (e) {
      out.subscribe_attempt = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // 2) THE key check — is the app subscribed to this account, and for which fields?
  out.subscribed_apps = await graph(`${encodeURIComponent(accountId)}/subscribed_apps`);

  // Interpret the subscription result for a quick human read.
  const subs = out.subscribed_apps as { json?: { data?: Array<{ subscribed_fields?: string[] }> } };
  const data = subs?.json?.data || [];
  const fields = data.flatMap((d) => d.subscribed_fields || []);
  out.verdict = data.length === 0
    ? "❌ NOT SUBSCRIBED — no app is subscribed to this IG account. This is why no webhooks arrive. Fix: POST subscribed_apps with subscribed_fields=comments (see below)."
    : fields.includes("comments")
      ? "✅ Subscribed and 'comments' is in the field list — webhooks should deliver."
      : `⚠️ Subscribed, but 'comments' NOT in fields (${fields.join(", ") || "none"}). Re-subscribe including comments.`;

  return NextResponse.json(out);
}

/**
 * POST → subscribe THIS IG account to the app for the `comments` field.
 * This is the step the dashboard toggle does not do. Admin-only, idempotent.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.IG_PAGE_TOKEN || "";
  const accountId = process.env.IG_ACCOUNT_ID || "";
  if (!token || !accountId) return NextResponse.json({ error: "IG env not configured" }, { status: 400 });

  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(accountId)}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ status: res.status, json });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
