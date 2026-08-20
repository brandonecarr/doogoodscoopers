import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";

// Shared "turn a door-conversation transcript into notes on the pin" logic, used
// by both capture paths: Web Speech (Chrome, live on-device) and audio-record →
// server transcription (iOS Safari). Audio is never stored; only notes are kept.

const MODEL = "claude-sonnet-5";

const SYSTEM = `You are the note-taker for a door-to-door sales rep at DooGoodScoopers, a residential pooper-scooper service. You are given the raw, unlabeled speech transcript of a conversation at a homeowner's front door (the rep and the homeowner, both voices mixed, transcription may be imperfect).

Write tight, skimmable notes the rep and the office can act on later. Use short bullet points under these headers, and OMIT any header with nothing to say:
- Interest: (hot / warm / cold, in a few words)
- Dogs & yard: (number of dogs, yard size/access, current cleanup habit)
- Objections: (price, trust, timing, "already have someone", etc.)
- Commitments / next step: (quote given, callback time, "think about it", signed up, etc.)
- Contact: (any name, phone, email, or best time mentioned)

Keep it to what was actually said — do not invent details. Be concise (a rep reads this on a phone). If the transcript is empty or has no usable content, reply with exactly: No usable notes captured.`;

export async function summarizeTranscript(transcript: string): Promise<string> {
  const t = transcript.trim().slice(0, 12000);
  if (!t) return "";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: "user", content: `Transcript:\n"""\n${t}\n"""` }],
      });
      const out = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (out) return out;
    } catch (e) {
      console.error("[canvasser-notes] summarize failed:", e);
    }
  }
  // Fallback: keep the raw transcript so nothing is lost.
  return `Transcript (AI summary unavailable):\n${t}`;
}

/**
 * Ownership-checked. Summarize the transcript and append it (time-stamped) to
 * the caller's own pin. Returns the merged aiNotes, or null if the pin isn't
 * theirs / doesn't exist.
 */
export async function saveDoorNotes(userId: string, clientKey: string, transcript: string): Promise<string | null> {
  const visit = await prisma.canvassVisit.findUnique({ where: { clientKey } });
  if (!visit || visit.canvasserId !== userId) return null;

  const aiNotes = await summarizeTranscript(transcript);
  const stamped = `— ${new Date().toISOString().slice(0, 16).replace("T", " ")} (AI)\n${aiNotes}`;
  const merged = visit.aiNotes ? `${visit.aiNotes}\n\n${stamped}` : stamped;

  await prisma.canvassVisit.updateMany({
    where: { clientKey, canvasserId: userId },
    data: { aiNotes: merged },
  });
  return merged;
}
