"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";

/**
 * At-the-door AI note-taker. Consent-gated (the rep confirms they've told the
 * homeowner). Two capture engines, chosen by what the device supports:
 *   • "speech" — Web Speech API (Chrome): transcribes ON-DEVICE, no audio upload.
 *   • "record" — MediaRecorder (iOS Safari): records a short clip, uploads it to
 *     be transcribed server-side, then the audio is discarded.
 *
 * Browsers suspend the mic + JS when the page is backgrounded or the phone locks,
 * so we (a) hold a screen Wake Lock while listening to stop the auto-lock, and
 * (b) if the app IS backgrounded, we stop and save what was captured so far —
 * never leaving the UI stuck. True background recording needs a native app.
 */

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
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const c of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
type Engine = "speech" | "record" | null;
type Phase = "idle" | "consent" | "active" | "processing";
const MAX_SECONDS = 5 * 60;

export function DoorListen({ clientKey, onNotes }: { clientKey: string; onNotes: (aiNotes: string) => void }) {
  const [engine, setEngine] = useState<Engine>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const phaseRef = useRef(phase); useEffect(() => { phaseRef.current = phase; }, [phase]);
  const interimRef = useRef(""); useEffect(() => { interimRef.current = interim; }, [interim]);

  // speech engine
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const stoppingRef = useRef(false);
  // record engine
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/mp4");
  const uploadedRef = useRef(false);
  // shared
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  const finalizeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (getRecognitionCtor()) setEngine("speech");
    else if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined") setEngine("record");
    else setEngine(null);
  }, []);

  // ── Screen wake lock (keep the screen on while listening) ───────────────
  const requestWake = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.wakeLock?.request) wakeRef.current = await nav.wakeLock.request("screen");
    } catch { /* not supported / denied — fine */ }
  };
  const releaseWake = () => { try { wakeRef.current?.release?.(); } catch { /* noop */ } wakeRef.current = null; };

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  const cleanup = () => {
    clearTimer();
    stoppingRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    try { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); } catch { /* noop */ }
    stopStream();
    releaseWake();
  };
  useEffect(() => () => cleanup(), []);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SECONDS) finalizeRef.current();
        return s + 1;
      });
    }, 1000);
  };

  // ── Speech engine ──────────────────────────────────────────────────────
  const startSpeech = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    transcriptRef.current = ""; setInterim(""); stoppingRef.current = false; finalizingRef.current = false;
    const rec = new Ctor();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
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
        stoppingRef.current = true; releaseWake(); clearTimer(); setPhase("idle");
      }
    };
    rec.onend = () => { if (!stoppingRef.current) { try { rec.start(); } catch { /* noop */ } } };
    recRef.current = rec;
    try { rec.start(); setPhase("active"); startTimer(); void requestWake(); }
    catch { setError("Couldn't start listening. Try again."); setPhase("idle"); }
  };

  const finalizeSpeech = async () => {
    const text = (transcriptRef.current + " " + interimRef.current).trim();
    setInterim("");
    if (!text) { setPhase("idle"); setError("Nothing was heard — try again a little closer."); finalizingRef.current = false; return; }
    setPhase("processing");
    try {
      const res = await fetch("/api/canvasser/ai-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey, transcript: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't save the notes."); setPhase("idle"); }
      else { onNotes(data.aiNotes); setPhase("idle"); }
    } catch {
      setError("You may be offline — notes need a connection. Try again in coverage.");
      setPhase("idle");
    } finally { finalizingRef.current = false; }
  };

  // ── Record engine ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      mimeRef.current = mime || "audio/mp4";
      uploadedRef.current = false; finalizingRef.current = false;
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => { void uploadRecording(); };
      mediaRef.current = mr;
      mr.start();
      setPhase("active"); startTimer(); void requestWake();
    } catch {
      setError("Microphone access was blocked. Allow the mic for this site and try again.");
      setPhase("idle");
    }
  };

  const uploadRecording = async () => {
    if (uploadedRef.current) return;
    uploadedRef.current = true;
    stopStream(); releaseWake();
    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    chunksRef.current = [];
    if (blob.size < 1200) { setError("Nothing was recorded — try again a little closer."); setPhase("idle"); finalizingRef.current = false; return; }
    setPhase("processing");
    try {
      const ext = mimeRef.current.includes("mp4") ? "m4a" : mimeRef.current.includes("webm") ? "webm" : mimeRef.current.includes("ogg") ? "ogg" : "m4a";
      const form = new FormData();
      form.append("clientKey", clientKey);
      form.append("audio", blob, `door.${ext}`);
      const res = await fetch("/api/canvasser/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't save the notes."); setPhase("idle"); }
      else { onNotes(data.aiNotes); setPhase("idle"); }
    } catch {
      setError("You may be offline — notes need a connection. Try again in coverage.");
      setPhase("idle");
    } finally { finalizingRef.current = false; }
  };

  // ── Shared controls ────────────────────────────────────────────────────
  const beginActive = () => {
    setError("");
    if (engine === "speech") startSpeech();
    else if (engine === "record") void startRecording();
  };

  const finalize = () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    clearTimer(); releaseWake();
    if (engine === "speech") {
      stoppingRef.current = true;
      try { recRef.current?.stop(); } catch { /* noop */ }
      void finalizeSpeech();
    } else {
      // Stop the recorder if it's live; if it already died (e.g. backgrounded),
      // upload whatever we captured directly.
      const mr = mediaRef.current;
      if (mr && mr.state === "recording") { setPhase("processing"); try { mr.stop(); } catch { void uploadRecording(); } }
      else { setPhase("processing"); void uploadRecording(); }
    }
  };
  useEffect(() => { finalizeRef.current = finalize; });

  // If the app is backgrounded / screen locked while listening, the mic is
  // suspended by the browser — so stop cleanly and save what we have, and never
  // leave the UI frozen. Re-grab the wake lock when we come back (if still busy).
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        if (phaseRef.current === "active") finalizeRef.current();
      } else if (phaseRef.current === "active") {
        void requestWake();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("pagehide", onHidden); };
  }, []);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (engine === null) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800 flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Live AI note-taking isn&apos;t available in this browser — you can still type notes above.</span>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        <p className="text-[12.5px] font-bold text-violet-900 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Before you start</p>
        <p className="text-[12px] text-violet-800 mt-1 leading-relaxed">
          Tell the homeowner: <em>&ldquo;I have an AI assistant that listens and takes notes for us — is that okay?&rdquo;</em> The audio is used only to create the notes and is <strong>not kept</strong>.
        </p>
        <p className="text-[11px] text-violet-700/80 mt-1.5">Keep this screen open while it listens — if you switch apps or lock the phone, it saves the notes so far and stops.</p>
        <div className="flex gap-2 mt-2.5">
          <button onClick={beginActive} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white" style={{ background: "#6D3EF0" }}>
            <Mic className="w-4 h-4" /> They said yes — start
          </button>
          <button onClick={() => setPhase("idle")} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200">Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === "active") {
    return (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-rose-700">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" /></span>
            AI is listening &amp; taking notes · {mmss(elapsed)}
          </span>
          <button onClick={finalize} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white" style={{ background: "#E11D48" }}>
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        </div>
        <p className="text-[11px] text-rose-600/80 mt-1.5">Homeowner has been informed. Keep the screen open — audio isn&apos;t saved.</p>
        {engine === "speech" && interim && <p className="text-[12px] text-gray-500 mt-2 italic line-clamp-2">…{interim}</p>}
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
