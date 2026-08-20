"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Database, ChevronDown, Bot, User2, AlertCircle } from "lucide-react";

interface Step { tool: string; purpose?: string; sql?: string; rowCount?: number; error?: string }
interface Msg { role: "user" | "assistant"; content: string; steps?: Step[]; error?: boolean }

const SUGGESTIONS = [
  "How are we doing this month?",
  "How many new leads came in the last 7 days, by source?",
  "What's my active customer count and estimated MRR?",
  "How did signups this month compare to last month?",
  "What are the most common cancellation reasons?",
  "Which ZIP codes have the most active customers?",
];

const THINKING = ["Reading the question…", "Pulling live numbers…", "Running the query…", "Double-checking the data…", "Writing it up…"];

// Minimal, safe formatter: **bold**, `code`, "- " bullets, and line breaks.
function Formatted({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-gray-800">
      {lines.map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const clean = line.replace(/^\s*[-•]\s+/, "");
        const parts = clean.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
        const rendered = parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} className="font-bold text-gray-900">{p.slice(2, -2)}</strong>;
          if (p.startsWith("`") && p.endsWith("`")) return <code key={j} className="px-1 py-0.5 rounded bg-gray-100 text-[12px] font-mono">{p.slice(1, -1)}</code>;
          return <span key={j}>{p}</span>;
        });
        if (!clean.trim()) return <div key={i} className="h-1" />;
        return bullet
          ? <div key={i} className="flex gap-2"><span className="text-violet-400 mt-0.5">•</span><span>{rendered}</span></div>
          : <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const queries = steps.filter((s) => s.tool === "query_database").length;
  const label = [queries ? `${queries} quer${queries === 1 ? "y" : "ies"}` : "", steps.some((s) => s.tool === "business_snapshot") ? "snapshot" : ""].filter(Boolean).join(" · ");
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-violet-600">
        <Database className="w-3 h-3" /> Data used ({label || steps.length}) <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <div className="text-[11px] font-semibold text-gray-500">
                {s.tool === "business_snapshot" ? "Business snapshot" : s.purpose || "Query"}
                {typeof s.rowCount === "number" && <span className="text-gray-400"> · {s.rowCount} row{s.rowCount === 1 ? "" : "s"}</span>}
                {s.error && <span className="text-rose-500"> · error</span>}
              </div>
              {s.sql && <pre className="mt-1 text-[11px] font-mono text-gray-600 whitespace-pre-wrap break-words">{s.sql}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AskChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((n) => n + 1), 2200);
    return () => clearInterval(t);
  }, [busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setTick(0);
    try {
      const res = await fetch("/api/admin/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", content: data.error || "Something went wrong.", error: true }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: data.answer || "No answer.", steps: data.steps || [] }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Couldn't reach the assistant. Try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dgs-card flex flex-col" style={{ height: "calc(100vh - 230px)", minHeight: 440 }}>
      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {msgs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
              <Bot className="w-6 h-6 text-white" />
            </div>
            <p className="text-[15px] font-bold text-navy-900">Ask about your business</p>
            <p className="text-[13px] text-gray-500 mt-1 max-w-sm">I read your live leads, customers, revenue, and reviews to answer in real time. Try one of these:</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium text-violet-700 border border-violet-200 bg-violet-50/50 hover:bg-violet-100">{s}</button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: m.error ? "#FEE2E2" : "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
                {m.error ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
            )}
            <div className={`max-w-[85%] ${m.role === "user" ? "order-1" : ""}`}>
              {m.role === "user" ? (
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[13.5px] text-white" style={{ background: "#6D3EF0" }}>{m.content}</div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100">
                  <Formatted text={m.content} />
                  {m.steps && <Steps steps={m.steps} />}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5 order-2"><User2 className="w-4 h-4 text-gray-500" /></div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}><Bot className="w-4 h-4 text-white" /></div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 inline-flex items-center gap-2 text-[13px] text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {THINKING[tick % THINKING.length]}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about leads, customers, revenue, reviews…"
            rows={1}
            className="flex-1 resize-none px-3.5 py-2.5 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-violet-300 max-h-32"
          />
          <button type="submit" disabled={busy || !input.trim()} className="h-[42px] px-4 rounded-xl text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "#6D3EF0" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-[11px] text-gray-400 mt-1.5 px-1">Answers come from your live data. Double-check anything you act on — AI can make mistakes.</p>
      </div>
    </div>
  );
}
