import { NextResponse } from "next/server";
import { authenticateTv } from "@/lib/tv-connector";

export const dynamic = "force-dynamic";

/** Connection test for the Apple TV's "Connect" button. */
export async function GET(request: Request) {
  if (!(await authenticateTv(request))) return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  return NextResponse.json({ ok: true, name: "DooGoodScoopers Admin", apiVersion: 1 });
}
