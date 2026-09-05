import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clearFbConnection } from "@/lib/facebook-connect";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearFbConnection();
  return NextResponse.json({ ok: true });
}
