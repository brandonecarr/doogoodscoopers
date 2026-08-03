import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Instagram-Login tokens (IGAA…) must go to Instagram's host, not graph.facebook.com.
const GRAPH = "https://graph.instagram.com/v21.0";

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
    // App secret should be 32 lowercase hex chars, no whitespace. A stray
    // newline/space (or wrong value) makes every webhook signature check fail.
    app_secret_shape: process.env.META_APP_SECRET
      ? {
          length: process.env.META_APP_SECRET.length,
          looksLike32Hex: /^[a-f0-9]{32}$/.test(process.env.META_APP_SECRET),
          hasWhitespace: /\s/.test(process.env.META_APP_SECRET),
          hasLeadingOrTrailingSpace: process.env.META_APP_SECRET !== process.env.META_APP_SECRET.trim(),
          prefix: process.env.META_APP_SECRET.slice(0, 4),
          suffix: process.env.META_APP_SECRET.slice(-4),
        }
      : "MISSING",
    // Safe shape inspection of the token — only 6 chars of each end + hygiene flags.
    token_shape: token
      ? {
          prefix: token.slice(0, 6),
          suffix: token.slice(-4),
          length: token.length,
          startsWithIGAA: token.startsWith("IGAA"),
          startsWithEAA: token.startsWith("EAA"),
          hasWhitespace: /\s/.test(token),
          hasLeadingOrTrailingSpace: token !== token.trim(),
          hasNewline: /[\r\n]/.test(token),
          hasQuotes: /["']/.test(token),
        }
      : null,
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

  // 1) Who is this account / is the token valid? /me always maps to the token owner.
  out.account = await graph(`me?fields=user_id,username,account_type`);

  // Confirm IG_ACCOUNT_ID matches the token's actual account (a mismatch breaks DM sends).
  const meId = (out.account as { json?: { user_id?: string; id?: string } })?.json?.user_id
    ?? (out.account as { json?: { id?: string } })?.json?.id;
  out.account_id_check = meId
    ? meId === accountId
      ? `✅ IG_ACCOUNT_ID matches the token's account (${accountId})`
      : `⚠️ MISMATCH — IG_ACCOUNT_ID is ${accountId} but the token's account is ${meId}. Set IG_ACCOUNT_ID to ${meId}.`
    : "could not read the token's account id";

  // Optional one-click fix: subscribe this account to `comments` (via /me = token owner).
  if (doSubscribe) {
    try {
      const res = await fetch(
        `${GRAPH}/me/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      out.subscribe_attempt = { status: res.status, json: await res.json().catch(() => ({})) };
    } catch (e) {
      out.subscribe_attempt = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // 2) THE key check — is the app subscribed to this account, and for which fields?
  out.subscribed_apps = await graph(`me/subscribed_apps`);

  // Interpret the subscription result for a quick human read.
  const subs = out.subscribed_apps as { json?: { data?: Array<{ subscribed_fields?: string[] }> } };
  const data = subs?.json?.data || [];
  const fields = data.flatMap((d) => d.subscribed_fields || []);
  out.verdict = data.length === 0
    ? "❌ NOT SUBSCRIBED — no app is subscribed to this IG account. This is why no webhooks arrive. Fix: POST subscribed_apps with subscribed_fields=comments (see below)."
    : fields.includes("comments")
      ? "✅ Subscribed and 'comments' is in the field list — webhooks should deliver."
      : `⚠️ Subscribed, but 'comments' NOT in fields (${fields.join(", ") || "none"}). Re-subscribe including comments.`;

  // Recompute the signature for the most recent REAL webhook using the CURRENTLY
  // deployed secret — definitively answers "is the live secret the right signer?"
  // without needing another comment.
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "raw","sigHeader","createdAt" FROM "IgWebhookEvent" WHERE "sigHeader" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`,
    )) as Array<{ raw: string; sigHeader: string; createdAt: Date }>;
    const row = rows?.[0];
    if (row && process.env.META_APP_SECRET) {
      const liveComputed = "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET).update(row.raw, "utf8").digest("hex");
      out.live_secret_vs_last_webhook = {
        lastWebhookAt: row.createdAt,
        metaSent: row.sigHeader,
        liveComputes: liveComputed,
        matches: liveComputed === row.sigHeader,
        note:
          liveComputed === row.sigHeader
            ? "✅ The deployed secret matches Meta's signature — webhooks will verify now."
            : "❌ The deployed secret does NOT match Meta's signature. Either the redeploy hasn't taken, or this still isn't the signing secret.",
      };
    } else {
      out.live_secret_vs_last_webhook = "No captured webhook with a signature yet.";
    }
  } catch (e) {
    out.live_secret_vs_last_webhook = { error: e instanceof Error ? e.message : "failed" };
  }

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
      `${GRAPH}/me/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ status: res.status, json });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
