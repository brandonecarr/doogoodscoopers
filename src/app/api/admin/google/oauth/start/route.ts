import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleOAuthConfigured, buildAuthUrl } from "@/lib/google-business";

// Kick off the Google Business Profile OAuth consent flow.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = request.nextUrl.origin;
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/admin/reviews?google=notconfigured", origin));
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(origin, state));
  res.cookies.set("g_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
