import { NextResponse } from "next/server";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { saveDoorNotes } from "@/lib/canvasser-notes";

// Text path (Chrome/Web Speech): the device transcribes on-device — audio is
// never uploaded — and posts the transcript here. Claude summarizes it into
// notes attached to the caller's own pin.

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clientKey = typeof body.clientKey === "string" ? body.clientKey : "";
  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  if (!clientKey) return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  if (!transcript.trim()) return NextResponse.json({ error: "Nothing was captured." }, { status: 400 });

  const aiNotes = await saveDoorNotes(user.id, clientKey, transcript);
  if (aiNotes === null) return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  return NextResponse.json({ aiNotes });
}
