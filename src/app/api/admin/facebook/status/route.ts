import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFbConnection } from "@/lib/facebook-connect";
import { setSetting } from "@/lib/google-business";

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
  if (typeof b.loginConfigId === "string") await setSetting("facebook.loginConfigId", b.loginConfigId.replace(/\D/g, "").slice(0, 32));
  return NextResponse.json({ ok: true });
}
