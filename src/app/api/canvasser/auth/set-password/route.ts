import { NextResponse } from "next/server";
import { acceptCanvasserInvite } from "@/lib/canvasser-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || !password) return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
  const res = await acceptCanvasserInvite(String(token), String(password));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
