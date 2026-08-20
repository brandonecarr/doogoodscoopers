import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getCanvasserSession } from "@/lib/canvasser-auth";

// At-the-door AI note-taker. The canvasser's device transcribes the conversation
// on-device (Web Speech API) — audio is NEVER uploaded or stored. Only the text
// transcript is sent here, Claude turns it into concise notes, and those notes
// are attached to the canvasser's own pin. Gated to the caller and their row.

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MODEL = "claude-sonnet-5";

const SYSTEM = `You are the note-taker for a door-to-door sales rep at DooGoodScoopers, a residential pooper-scooper service. You are given the raw, unlabeled speech transcript of a conversation at a homeowner's front door (the rep and the homeowner, both voices mixed, transcription may be imperfect).

Write tight, skimmable notes the rep and the office can act on later. Use short bullet points under these headers, and OMIT any header with nothing to say:
- Interest: (hot / warm / cold, in a few words)
- Dogs & yard: (number of dogs, yard size/access, current cleanup habit)
- Objections: (price, trust, timing, "already have someone", etc.)
- Commitments / next step: (quote given, callback time, "think about it", signed up, etc.)
- Contact: (any name, phone, email, or best time mentioned)

Keep it to what was actually said — do not invent details. Be concise (a rep reads this on a phone). If the transcript is empty or has no usable content, reply with exactly: No usable notes captured.`;

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clientKey = typeof body.clientKey === "string" ? body.clientKey : "";
  const transcript = (typeof body.transcript === "string" ? body.transcript : "").trim().slice(0, 12000);
  if (!clientKey) return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  if (!transcript) return NextResponse.json({ error: "Nothing was captured." }, { status: 400 });

  // Ownership guard — only annotate the caller's own pin.
  const visit = await prisma.canvassVisit.findUnique({ where: { clientKey } });
  if (!visit || visit.canvasserId !== user.id) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  // Summarize with Claude; fall back to the raw transcript so nothing is lost.
  let aiNotes = "";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: "user", content: `Transcript:\n"""\n${transcript}\n"""` }],
      });
      aiNotes = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    } catch (e) {
      console.error("[canvasser/ai-notes]", e);
    }
  }
  if (!aiNotes) {
    aiNotes = `Transcript (AI summary unavailable):\n${transcript}`;
  }

  // Stamp it and append under any prior AI notes (a rep may listen more than once).
  const stamped = `— ${new Date().toISOString().slice(0, 16).replace("T", " ")} (AI)\n${aiNotes}`;
  const merged = visit.aiNotes ? `${visit.aiNotes}\n\n${stamped}` : stamped;

  await prisma.canvassVisit.updateMany({
    where: { clientKey, canvasserId: user.id },
    data: { aiNotes: merged },
  });

  return NextResponse.json({ aiNotes: merged });
}
