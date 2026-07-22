import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  exchangeCodeForTokens, listAccounts, listLocations, getUserEmail, setSetting, idFromName,
} from "@/lib/google-business";

// Google OAuth redirect target: exchange code → store refresh token + account/location.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams, origin } = request.nextUrl;
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/reviews?google=${q}`, origin));

  if (searchParams.get("error")) return back("denied");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("g_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) return back("state");

  try {
    const tokens = await exchangeCodeForTokens(code, origin);
    if (tokens.refresh_token) await setSetting("google.oauth.refreshToken", tokens.refresh_token);

    // Pick the first account + location automatically (most orgs have one).
    const accounts = await listAccounts(tokens.access_token);
    if (accounts.length) {
      const acc = accounts[0];
      await setSetting("google.bp.accountId", idFromName(acc.name));
      const locations = await listLocations(acc.name, tokens.access_token);
      if (locations.length) {
        await setSetting("google.bp.locationId", idFromName(locations[0].name));
        await setSetting("google.bp.locationTitle", locations[0].title || "");
      }
    }
    const email = await getUserEmail(tokens.access_token).catch(() => null);
    if (email) await setSetting("google.bp.connectedEmail", email);

    const res = back("connected");
    res.cookies.delete("g_oauth_state");
    return res;
  } catch (e) {
    console.error("[google oauth callback]", e);
    return back("error");
  }
}
