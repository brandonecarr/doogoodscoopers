import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildFbAuthUrl, fbConfigured } from "@/lib/facebook-connect";

/** Step 1 of Connect Facebook Page: send the admin to the Facebook Login dialog. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.nextUrl.origin;
  if (!fbConfigured()) return NextResponse.redirect(new URL("/admin/messenger?facebook=notconfigured", origin));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(await buildFbAuthUrl(origin, state));
  res.cookies.set("fb_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
