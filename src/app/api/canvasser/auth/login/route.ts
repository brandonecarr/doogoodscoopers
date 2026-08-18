import { NextResponse } from "next/server";
import { canvasserLogin } from "@/lib/canvasser-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  const res = await canvasserLogin(String(email), String(password));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json({ ok: true });
}
