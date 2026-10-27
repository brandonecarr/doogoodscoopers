import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disconnectQuo } from "@/lib/quo-mcp";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectQuo();
  return NextResponse.json({ ok: true });
}
