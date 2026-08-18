import { NextResponse } from "next/server";
import { destroyCanvasserSession } from "@/lib/canvasser-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroyCanvasserSession();
  return NextResponse.json({ ok: true });
}
