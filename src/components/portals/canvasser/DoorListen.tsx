"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";

/**
 * At-the-door AI note-taker.
 *
 * Consent-gated: the rep must confirm they've told the homeowner an AI is
 * listening before it starts. Transcription runs ON-DEVICE via the browser's
 * Web Speech API — audio is never uploaded or stored. Only the text transcript
 * is sent to the server, where Claude turns it into notes attached to the pin.
 */

// The Web Speech API isn't in the TS DOM lib; describe just what we touch.
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Phase = "idle" | "consent" | "listening" | "processing";

export function DoorListen({ clientKey, onNotes }: { clientKey: string; onNotes: (aiNotes: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const stoppingRef = useRef(false);

  useEffect(() => { setSupported(!!getRecognitionCtor()); }, []);
  // Safety: if the sheet unmounts mid-listen, stop the mic.
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  const beginListening = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setSupported(false); return; }
    setError("");
    transcriptRef.current = "";
    setInterim("");
    stoppingRef.current = false;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) transcriptRef.current += r[0].transcript + " ";
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked. Enable the mic for this site and try again.");
        stoppingRef.current = true;
        setPhase("idle");
      }
    };
    // Chrome ends the session after a pause — restart until the rep taps Stop.
    rec.onend = () => {
      if (!stoppingRef.current) { try { rec.start(); } catch { /* noop */ } }
    };
    recRef.current = rec;
    try { rec.start(); setPhase("listening"); }
    catch { setError("Couldn't start listening. Try again."); setPhase("idle"); }
  };

  const stopAndSummarize = async () => {
    stoppingRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    const text = (transcriptRef.current + " " + interim).trim();
    setInterim("");
    if (!text) { setPhase("idle"); setError("Nothing was heard — try again a little closer."); return; }
    setPhase("processing");
    try {
      const res = await fetch("/api/canvasser/ai-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey, transcript: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't save the notes."); setPhase("idle"); return; }
      onNotes(data.aiNotes);
      setPhase("idle");
    } catch {
      setError("You may be offline — notes need a connection. Try again in coverage.");
      setPhase("idle");
    }
  };

  if (!supported) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800 flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Live AI note-taking needs Chrome (Android or desktop). It isn&apos;t available in this browser — you can still type notes above.</span>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        <p className="text-[12.5px] font-bold text-violet-900 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Before you start</p>
        <p className="text-[12px] text-violet-800 mt-1 leading-relaxed">
          Tell the homeowner: <em>&ldquo;I have an AI assistant that listens and takes notes for us — is that okay?&rdquo;</em> Audio is <strong>not recorded or saved</strong> — only written notes are kept.
        </p>
        <div className="flex gap-2 mt-2.5">
          <button onClick={beginListening} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white" style={{ background: "#6D3EF0" }}>
            <Mic className="w-4 h-4" /> They said yes — start
          </button>
          <button onClick={() => setPhase("idle")} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200">Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === "listening") {
    return (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-rose-700">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" /></span>
            AI is listening & taking notes
          </span>
          <button onClick={stopAndSummarize} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white" style={{ background: "#E11D48" }}>
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        </div>
        <p className="text-[11px] text-rose-600/80 mt-1.5">Homeowner has been informed. Audio isn&apos;t saved.</p>
        {interim && <p className="text-[12px] text-gray-500 mt-2 italic line-clamp-2">…{interim}</p>}
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 inline-flex items-center gap-2 text-[12.5px] text-gray-600 w-full">
        <Loader2 className="w-4 h-4 animate-spin" /> Writing up the notes…
      </div>
    );
  }

  // idle
  return (
    <div className="mt-3">
      <button onClick={() => { setError(""); setPhase("consent"); }} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
        <Sparkles className="w-4 h-4" /> Listen — AI note-taker
      </button>
      {error && <p className="text-[11.5px] text-rose-600 mt-1.5">{error}</p>}
    </div>
  );
}
