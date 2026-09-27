import { NextResponse } from "next/server";
import { authenticateTv } from "@/lib/tv-connector";
import { buildTvSnapshot } from "@/lib/tv-snapshot";

export const dynamic = "force-dynamic";

/** Everything the Apple TV board shows from the admin, in one call (polled every minute). */
export async function GET(request: Request) {
  if (!(await authenticateTv(request))) return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  try {
    return NextResponse.json(await buildTvSnapshot());
  } catch (error) {
    console.error("TV snapshot failed:", error);
    return NextResponse.json({ error: "Failed to build snapshot" }, { status: 500 });
  }
}
