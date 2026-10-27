import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { finishQuoConnect, appUrl } from "@/lib/quo-mcp";

export const dynamic = "force-dynamic";

/** Quo sends the browser back here with ?code&state after the owner approves access. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${appUrl()}/admin/login`);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const err = searchParams.get("error");
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/admin/settings?${q}#sona`);
  if (err) return back(`quo=error&msg=${encodeURIComponent(searchParams.get("error_description") || err)}`);
  if (!code) return back("quo=error&msg=" + encodeURIComponent("Quo did not return an authorization code."));
  try {
    await finishQuoConnect(code, state, session.email);
    return back("quo=connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(`quo=error&msg=${encodeURIComponent(msg)}`);
  }
}
