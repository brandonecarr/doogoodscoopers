import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { quoMcpStatus, quoInboxes, QuoNotConnectedError } from "@/lib/quo-mcp";

export const dynamic = "force-dynamic";

/** Connection state, plus a live check (list the Quo numbers) when ?live=1. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await quoMcpStatus();
  const live = new URL(request.url).searchParams.get("live") === "1";
  if (!live || !status.connected) return NextResponse.json({ ...status, inboxes: null, liveError: null });
  try {
    const inboxes = await quoInboxes();
    return NextResponse.json({ ...status, inboxes, liveError: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ...status, connected: !(e instanceof QuoNotConnectedError), inboxes: null, liveError: msg });
  }
}
