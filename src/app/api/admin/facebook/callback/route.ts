import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exchangeFbCode, fbUserName, listFbPages } from "@/lib/facebook-connect";
import { setSetting } from "@/lib/google-business";

/** Step 2: Facebook sends the code back; exchange it and list the Pages the admin can pick from. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams, origin } = request.nextUrl;
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/messenger?facebook=${q}`, origin));
  if (searchParams.get("error")) return back("denied");
  const code = searchParams.get("code"); const state = searchParams.get("state");
  const cookieState = request.cookies.get("fb_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) return back("state");
  try {
    const userToken = await exchangeFbCode(code, origin);
    const [name, pages] = await Promise.all([fbUserName(userToken).catch(() => ""), listFbPages(userToken)]);
    await setSetting("facebook.userToken", userToken);
    await setSetting("facebook.userName", name);
    await setSetting("facebook.pendingPages", JSON.stringify(pages));
    const res = back(pages.length ? "choose" : "nopages");
    res.cookies.delete("fb_oauth_state");
    return res;
  } catch (e) {
    console.error("[facebook callback]", e);
    return back("error&msg=" + encodeURIComponent(e instanceof Error ? e.message : "unknown"));
  }
}
