import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/google-business";

// The Facebook Messenger auto-greeting: on/off + the message text. Fires once
// per new conversation (guarded in the webhook), never repeats.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: (await getSetting("messenger.autoReplyEnabled")) === "true",
    message: (await getSetting("messenger.autoReply")) || "",
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.enabled === "boolean") await setSetting("messenger.autoReplyEnabled", b.enabled ? "true" : "false");
  if (typeof b.message === "string") await setSetting("messenger.autoReply", b.message.slice(0, 1000));
  return NextResponse.json({ ok: true });
}
