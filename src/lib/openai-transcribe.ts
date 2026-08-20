// Speech-to-text for the at-the-door recorder path (iOS Safari, which lacks the
// Web Speech API). Claude has no audio input, so transcription runs through
// OpenAI Whisper; the resulting text is then summarized by Claude elsewhere.
// Audio is forwarded transiently and never stored.

export function isTranscribeConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function transcribeAudio(file: Blob, filename: string): Promise<{ text?: string; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "Audio transcription isn't set up (OPENAI_API_KEY)." };

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-1");
  form.append("language", "en");
  form.append("response_format", "json");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data?.error?.message || `Transcription error ${res.status}` };
    }
    return { text: typeof data.text === "string" ? data.text : "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Transcription failed" };
  }
}
