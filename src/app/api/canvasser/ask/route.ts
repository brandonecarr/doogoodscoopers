import { NextResponse } from "next/server";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { askCanvasser, isAskCanvasserConfigured } from "@/lib/ask-canvasser";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAskCanvasserConfigured()) return NextResponse.json({ error: "The AI coach isn't set up yet." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
  const history: Turn[] = raw
    .filter((m): m is Turn => {
      const t = m as Turn;
      return (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string" && t.content.trim().length > 0;
    })
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No question." }, { status: 400 });
  }

  try {
    const result = await askCanvasser(user.id, user.name, history);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[canvasser/ask]", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
