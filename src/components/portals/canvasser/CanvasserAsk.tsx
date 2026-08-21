"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User2, AlertCircle } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; error?: boolean }

const SUGGESTIONS = [
  "How did I do today?",
  "How many doors this week, and how many became leads?",
  "Which homes should I follow up on?",
  "Which ZIP code is converting best for me?",
  "Show me the homes that mentioned dogs.",
];
const THINKING = ["Checking your numbers…", "Looking through your pins…", "Adding it up…", "Writing it up…"];

function Fmt({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-gray-800">
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const clean = line.replace(/^\s*[-•]\s+/, "");
        const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={j} className="font-bold text-gray-900">{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
        );
        if (!clean.trim()) return <div key={i} className="h-1" />;
        return bullet ? <div key={i} className="flex gap-2"><span className="text-violet-400 mt-0.5">•</span><span>{parts}</span></div> : <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

export function CanvasserAsk() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setTick((n) => n + 1), 2000); return () => clearInterval(t); }, [busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setBusy(true); setTick(0);
    try {
      const res = await fetch("/api/canvasser/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsgs((m) => [...m, { role: "assistant", content: data.error || "Something went wrong.", error: true }]);
      else setMsgs((m) => [...m, { role: "assistant", content: data.answer || "No answer." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Couldn't reach the coach — check your connection.", error: true }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-100" style={{ height: "calc(100vh - 160px)", minHeight: 420 }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {msgs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}><Bot className="w-6 h-6 text-white" /></div>
            <p className="text-[15px] font-bold text-gray-900">Your canvassing coach</p>
            <p className="text-[13px] text-gray-500 mt-1 max-w-xs">Ask about your own doors, leads, and follow-ups. Try:</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium text-violet-700 border border-violet-200 bg-violet-50/50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: m.error ? "#FEE2E2" : "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>{m.error ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <Bot className="w-4 h-4 text-white" />}</div>}
            <div className="max-w-[85%]">
              {m.role === "user"
                ? <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[13.5px] text-white" style={{ background: "#6D3EF0" }}>{m.content}</div>
                : <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100"><Fmt text={m.content} /></div>}
            </div>
            {m.role === "user" && <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5"><User2 className="w-4 h-4 text-gray-500" /></div>}
          </div>
        ))}
        {busy && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}><Bot className="w-4 h-4 text-white" /></div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 inline-flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {THINKING[tick % THINKING.length]}</div>
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 p-2.5">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Ask about your canvassing…" rows={1} className="flex-1 resize-none px-3.5 py-2.5 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-violet-300 max-h-28" />
          <button type="submit" disabled={busy || !input.trim()} className="h-[42px] px-4 rounded-xl text-white font-semibold inline-flex items-center disabled:opacity-50" style={{ background: "#6D3EF0" }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
        </form>
      </div>
    </div>
  );
}
