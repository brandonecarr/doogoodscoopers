import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFbConnection, listFbPages } from "@/lib/facebook-connect";
import { getSetting, setSetting } from "@/lib/google-business";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getFbConnection());
}

/** Save the optional Facebook Login for Business configuration ID. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  // Re-run the Page listing with the last login's token — after fixing Page access, no new login needed.
  if (b.action === "relist") {
    const userToken = await getSetting("facebook.userToken");
    if (!userToken) return NextResponse.json({ error: "No Facebook login yet" }, { status: 400 });
    try {
      const pages = await listFbPages(userToken);
      await setSetting("facebook.pendingPages", JSON.stringify(pages));
      return NextResponse.json({ ok: true, count: pages.length });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "listing failed" }, { status: 502 }); }
  }
  if (typeof b.loginConfigId === "string") await setSetting("facebook.loginConfigId", b.loginConfigId.replace(/\D/g, "").slice(0, 32));
  return NextResponse.json({ ok: true });
}
