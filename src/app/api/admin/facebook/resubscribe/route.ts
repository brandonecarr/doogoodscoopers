import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/google-business";
import { getPageAccessToken, subscribePageWebhooks } from "@/lib/facebook-connect";

/** Re-subscribe the connected Page to the current webhook field set (adds Lead Ads). */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [pageId, token] = await Promise.all([getSetting("facebook.pageId"), getPageAccessToken()]);
  if (!pageId || !token) return NextResponse.json({ success: false, error: "No Page connected" }, { status: 400 });
  try {
    const fields = await subscribePageWebhooks(pageId, token);
    await setSetting("facebook.webhookFields", fields.join(","));
    return NextResponse.json({ success: true, fields });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "subscribe failed" }, { status: 502 });
  }
}
