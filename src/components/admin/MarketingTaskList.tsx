"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Images, ExternalLink } from "lucide-react";

export interface MarketingTaskItem {
  id: string;
  title: string;
  detail: string | null;
  channel: string;
  dayHint: string | null;
  effort: string | null;
  priority: number;
  rationale: string | null;
  status: string;
  caption: string | null;
  studioDraftId: string | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", google: "Google", sms: "SMS",
  email: "Email", referral: "Referral", signage: "Signage", reviews: "Reviews",
  website: "Website", local: "Local", ops: "Ops",
};
const CHANNEL_COLOR: Record<string, string> = {
  instagram: "#D4537E", facebook: "#2a78d6", google: "#1baf7a", sms: "#8B6BFF",
  email: "#6D3EF0", referral: "#16A34A", signage: "#BA7517", reviews: "#EDA100",
  website: "#378ADD", local: "#0F6E56", ops: "#5F5E5A",
};

export function MarketingTaskList({ tasks: initial }: { tasks: MarketingTaskItem[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyCaption = async (id: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      /* clipboard blocked — the caption is still visible to select manually */
    }
  };

  const toggle = async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const next = t.status === "DONE" ? "TODO" : "DONE";
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status: next } : x)));
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/marketing/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status: t.status } : x))); // revert
      else router.refresh();
    } catch {
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status: t.status } : x)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const done = t.status === "DONE";
        const color = CHANNEL_COLOR[t.channel] ?? "#5F5E5A";
        return (
          <div key={t.id} className={`dgs-card p-4 transition-opacity ${done ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggle(t.id)}
                disabled={busy === t.id}
                aria-label={done ? "Mark not done" : "Mark done"}
                className="mt-0.5 w-5 h-5 rounded-[6px] flex-shrink-0 flex items-center justify-center transition-colors border"
                style={done ? { background: "#16A34A", borderColor: "#16A34A" } : { borderColor: "#CFCFDA", background: "#fff" }}
              >
                {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className={`text-[14px] font-semibold text-ink ${done ? "line-through text-muted" : ""}`}>{t.title}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    {t.priority === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold" style={{ background: "#FDECEC", color: "#A32D2D" }}>High</span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white" style={{ background: color }}>
                      {CHANNEL_LABEL[t.channel] ?? t.channel}
                    </span>
                    {t.dayHint && t.dayHint !== "Any" && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-surface2 text-bodytext">{t.dayHint}</span>
                    )}
                    {t.effort && <span className="text-[11px] text-muted">{t.effort}</span>}
                  </div>
                </div>

                {t.detail && <p className={`text-[13px] leading-relaxed mt-1.5 text-bodytext ${done ? "line-through" : ""}`}>{t.detail}</p>}
                {t.rationale && <p className="text-[12px] text-muted mt-2 italic">Why: {t.rationale}</p>}

                {(t.caption || t.studioDraftId) && (
                  <div className="mt-3 rounded-[12px] border border-hairline bg-surface2/60 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Images className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                        Ready-to-post draft
                      </span>
                    </div>
                    {t.caption && (
                      <p className="text-[12.5px] leading-relaxed text-bodytext whitespace-pre-wrap">{t.caption}</p>
                    )}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      {t.caption && (
                        <button
                          onClick={() => copyCaption(t.id, t.caption!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold text-white transition-colors"
                          style={{ background: copied === t.id ? "#16A34A" : "#101014" }}
                        >
                          {copied === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === t.id ? "Copied" : "Copy caption"}
                        </button>
                      )}
                      {t.studioDraftId && (
                        <Link
                          href={`/admin/studio?draft=${t.studioDraftId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-colors"
                          style={{ background: "#EFE9FF", color: "#6D3EF0" }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open carousel in Studio
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
