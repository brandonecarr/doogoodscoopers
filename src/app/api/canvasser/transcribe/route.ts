import { NextResponse } from "next/server";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { isTranscribeConfigured, transcribeAudio } from "@/lib/openai-transcribe";
import { saveDoorNotes } from "@/lib/canvasser-notes";

// Audio path (iOS Safari): the device records a short clip and uploads it here.
// We transcribe it (Whisper), summarize the text (Claude), and attach the notes
// to the caller's own pin — then discard the audio. Nothing is stored.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 24 * 1024 * 1024; // Whisper's limit is 25MB; stay under

export async function POST(request: Request) {
  const user = await getCanvasserSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isTranscribeConfigured()) {
    return NextResponse.json({ error: "Audio note-taking isn't enabled yet (OPENAI_API_KEY not set)." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad upload." }, { status: 400 });
  }

  const clientKey = String(form.get("clientKey") || "");
  const audio = form.get("audio");
  if (!clientKey) return NextResponse.json({ error: "clientKey is required" }, { status: 400 });
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "No audio was uploaded." }, { status: 400 });
  if (audio.size < 1200) return NextResponse.json({ error: "Nothing was recorded." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long — keep it under ~10 minutes." }, { status: 413 });

  const filename = (audio instanceof File && audio.name) || "door.m4a";
  const t = await transcribeAudio(audio, filename);
  if (t.error) return NextResponse.json({ error: t.error }, { status: 502 });
  if (!t.text?.trim()) return NextResponse.json({ error: "Couldn't make out any speech in that recording." }, { status: 422 });

  const aiNotes = await saveDoorNotes(user.id, clientKey, t.text);
  if (aiNotes === null) return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  return NextResponse.json({ aiNotes });
}
