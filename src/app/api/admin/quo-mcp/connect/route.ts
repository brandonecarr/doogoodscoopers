import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { beginQuoConnect, appUrl } from "@/lib/quo-mcp";

export const dynamic = "force-dynamic";

/** Starts the one-time Quo sign-in (OAuth 2.1 + PKCE) and sends the browser to Quo. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${appUrl()}/admin/login`);
  try {
    const url = await beginQuoConnect();
    return NextResponse.redirect(url.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(`${appUrl()}/admin/settings?quo=error&msg=${encodeURIComponent(msg)}#sona`);
  }
}
