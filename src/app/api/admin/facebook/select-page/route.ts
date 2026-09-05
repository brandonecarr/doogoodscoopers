import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/google-business";
import { subscribePageWebhooks, type FbPage } from "@/lib/facebook-connect";

/** Step 3: the admin picks which Page the app messages from; subscribe it to Messenger webhooks. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pageId } = await request.json().catch(() => ({}));
  let pages: FbPage[] = [];
  try { pages = JSON.parse((await getSetting("facebook.pendingPages")) || "[]"); } catch { pages = []; }
  const page = pages.find((p) => p.id === String(pageId));
  if (!page?.access_token) return NextResponse.json({ error: "That Page isn't in the list from your last login. Connect again." }, { status: 400 });
  await setSetting("facebook.pageToken", page.access_token);
  await setSetting("facebook.pageId", page.id);
  await setSetting("facebook.pageName", page.name);
  await setSetting("facebook.pagePicture", page.picture || "");
  await setSetting("facebook.connectedAt", new Date().toISOString());
  await setSetting("facebook.pendingPages", "");
  let webhook: { ok: boolean; fields?: string[]; error?: string };
  try { const fields = await subscribePageWebhooks(page.id, page.access_token); await setSetting("facebook.webhookFields", fields.join(",")); webhook = { ok: true, fields }; }
  catch (e) { webhook = { ok: false, error: e instanceof Error ? e.message : "subscribe failed" }; await setSetting("facebook.webhookFields", ""); }
  return NextResponse.json({ ok: true, page: { id: page.id, name: page.name }, webhook });
}
