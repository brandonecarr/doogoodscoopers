import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { askDgs, isAskDgsConfigured } from "@/lib/ask-dgs";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the tool loop can take a while

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAskDgsConfigured()) {
    return NextResponse.json({ error: "Ask DGS isn't configured — set ANTHROPIC_API_KEY in the environment." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
  const history: Turn[] = raw
    .filter((m): m is Turn => {
      const t = m as Turn;
      return (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string" && t.content.trim().length > 0;
    })
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No question to answer." }, { status: 400 });
  }

  try {
    const result = await askDgs(history);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[ask-dgs]", e);
    return NextResponse.json({ error: "Something went wrong answering that. Please try again." }, { status: 500 });
  }
}
