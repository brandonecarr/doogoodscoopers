"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Loader2, X, AlertTriangle, ChevronDown, ChevronUp, Ban } from "lucide-react";

type LeadType = "QUOTE_FORM" | "AD_LEAD" | "COMMERCIAL" | "OUT_OF_AREA";
interface Call {
  id: string; status: string; createdAt: string; startedAt: string | null; endedAt: string | null;
  task: string; title: string | null; summary: string | null; collectedData: Record<string, unknown> | null; error: string | null; toNumber: string; startedBy: string;
}
interface Info { calls: Call[]; task: string | null; connected: boolean; fromNumber: string; toNumber: string | null; marketingAllowed: boolean | null; leadName: string | null; maxDurationSeconds: number }

const FINAL = new Set(["completed", "failed", "no-answer", "busy", "voicemail", "voicemail-left", "canceled", "error"]);
const LABEL: Record<string, string> = { queued: "Queued", "in-progress": "In progress", ringing: "Ringing", dialing: "Dialing", completed: "Completed", failed: "Failed", "no-answer": "No answer", busy: "Busy", voicemail: "Voicemail", "voicemail-left": "Left voicemail", canceled: "Canceled", error: "Error" };
const CHIP: Record<string, string> = { completed: "bg-green-100 text-green-800", "voicemail-left": "bg-blue-100 text-blue-800", voicemail: "bg-blue-100 text-blue-800", "no-answer": "bg-amber-100 text-amber-800", busy: "bg-amber-100 text-amber-800", failed: "bg-red-100 text-red-700", error: "bg-red-100 text-red-700", canceled: "bg-gray-100 text-gray-600" };
const fmtPhone = (e: string) => { const d = e.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e; };
const fmtTime = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/**
 * "Have Sona call": one button on a lead's profile. Opens a panel that shows exactly
 * what Sona will do (from, to, the task script, voicemail choice, cost); "Place call"
 * is the confirmation. Then polls until Quo reports a final status and shows the
 * summary, which is also written to the lead's timeline by the server.
 */
export function SonaCallCard({ leadType, leadId }: { leadType: LeadType; leadId: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [voicemail, setVoicemail] = useState<"hang-up" | "leave-message">("hang-up");
  const [vmMessage, setVmMessage] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (withTask = false) => {
    const r = await fetch(`/api/admin/sona-calls?leadType=${leadType}&leadId=${leadId}${withTask ? "&task=1" : ""}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as Info;
    setInfo(j);
    return j;
  }, [leadType, leadId]);

  useEffect(() => { load(); }, [load]);

  // Poll while any call is still running; the server refreshes from Quo on each GET.
  const running = info?.calls.find((c) => !FINAL.has(c.status));
  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/sona-calls/${running.id}`, { cache: "no-store" });
      if (r.ok) {
        const { call } = (await r.json()) as { call: Call };
        setInfo((prev) => prev ? { ...prev, calls: prev.calls.map((c) => (c.id === call.id ? call : c)) } : prev);
        if (FINAL.has(call.status)) router.refresh(); // timeline note is in now
      }
    }, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [running, info, router]);

  const begin = async () => {
    setError(null); setNeedsConsent(false); setOverride(false);
    const j = await load(true);
    if (!j) { setError("Couldn't load this lead."); return; }
    setTask(j.task || "");
    setVoicemail("hang-up");
    setVmMessage(`Hi${j.leadName ? ` ${j.leadName.split(" ")[0]}` : ""}, this is Sona calling for DooGoodScoopers about the yard cleanup you asked about. Give us a call or text at 909-366-3744 whenever it's convenient. Thanks!`);
    setOpen(true);
  };

  const place = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/admin/sona-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadType, leadId, task, voicemail, voicemailMessage: voicemail === "leave-message" ? vmMessage : null, overrideConsent: override }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.code === "consent") { setNeedsConsent(true); return; }
      if (!r.ok) { setError(j.error || "Quo did not start the call."); return; }
      setOpen(false);
      await load();
      router.refresh();
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    if (!confirm("Hang up this Sona call?")) return;
    await fetch(`/api/admin/sona-calls/${id}/cancel`, { method: "POST" });
    await load(); router.refresh();
  };

  const btn = "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const calls = info?.calls ?? [];

  return (
    <div className="dgs-card p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2"><PhoneCall className="w-4 h-4 text-teal-600" /> Sona calls</h2>
        {info && !info.connected ? (
          <a href="/admin/settings#sona" className="text-xs text-teal-700 hover:underline">Connect Quo in Settings</a>
        ) : (
          <button type="button" onClick={begin} disabled={!info || !info.toNumber || !!running} title={info && !info.toNumber ? "No usable phone number" : undefined} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            <PhoneCall className="w-3.5 h-3.5" /> Have Sona call
          </button>
        )}
      </div>

      {info && !info.toNumber && <p className="text-sm text-gray-500">This lead has no usable US phone number.</p>}

      {open && info && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-navy-900">Review the call before placing it</p>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/70" aria-label="Close"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">From</dt><dd className="text-navy-900">{fmtPhone(info.fromNumber)} (DooGoodScoopers)</dd>
            <dt className="text-gray-500">To</dt><dd className="text-navy-900">{info.toNumber ? fmtPhone(info.toNumber) : "—"}{info.leadName ? ` · ${info.leadName}` : ""}</dd>
            <dt className="text-gray-500">Cost</dt><dd className="text-navy-900">50 Quo automation credits (free if it ends within 15 seconds)</dd>
          </dl>
          {info.marketingAllowed === false && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> This lead answered no to marketing contact on the quote form.</p>
          )}
          <label className="block">
            <span className="text-xs font-medium text-gray-600">What Sona should do on the call</span>
            <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={9} maxLength={2000} className="mt-1 w-full text-sm rounded-lg border border-gray-200 p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white" />
            <span className="text-[11px] text-gray-400">{task.length} / 2000</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">If voicemail answers</span>
              <select value={voicemail} onChange={(e) => setVoicemail(e.target.value as "hang-up" | "leave-message")} className="mt-1 w-full text-sm rounded-lg border border-gray-200 p-2 bg-white">
                <option value="hang-up">Hang up (free)</option>
                <option value="leave-message">Leave a message</option>
              </select>
            </label>
            {voicemail === "leave-message" && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Voicemail message</span>
                <textarea value={vmMessage} onChange={(e) => setVmMessage(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full text-sm rounded-lg border border-gray-200 p-2 bg-white" />
              </label>
            )}
          </div>
          {needsConsent && (
            <label className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <span>This lead said no to marketing contact. I understand and still want Sona to call.</span>
            </label>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={place} disabled={busy || task.trim().length < 20 || (needsConsent && !override)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />} Place call
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
          </div>
        </div>
      )}

      {!open && error && <p className="text-sm text-red-700">{error}</p>}

      {calls.length === 0 ? (
        !open && <p className="text-sm text-gray-500">No Sona calls yet. Sona calls the lead from the business line, runs the script you approve, and files a summary here and on the timeline.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {calls.map((c) => {
            const live = !FINAL.has(c.status);
            const isOpen = expanded === c.id;
            return (
              <li key={c.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  {live ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> : null}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CHIP[c.status] || "bg-teal-100 text-teal-800"}`}>{LABEL[c.status] || c.status}</span>
                  <span className="text-xs text-gray-500">{fmtTime(c.startedAt || c.createdAt)}</span>
                  <span className="flex-1" />
                  {live && c.status !== "queued" && <button type="button" onClick={() => cancel(c.id)} className={`${btn} text-red-600`}><Ban className="w-3 h-3" /> Hang up</button>}
                  <button type="button" onClick={() => setExpanded(isOpen ? null : c.id)} className="p-1 rounded hover:bg-gray-100" aria-label="Details">{isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}</button>
                </div>
                {c.title && <p className="mt-1 text-sm font-medium text-navy-900">{c.title}</p>}
                {c.summary && <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-wrap">{c.summary}</p>}
                {c.error && <p className="mt-0.5 text-sm text-red-700">{c.error}</p>}
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    {c.collectedData && Object.keys(c.collectedData).length > 0 && (
                      <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        {Object.entries(c.collectedData).map(([k, v]) => <><dt key={`${k}-k`} className="text-gray-500">{k}</dt><dd key={`${k}-v`} className="text-navy-900">{typeof v === "string" ? v : JSON.stringify(v)}</dd></>)}
                      </dl>
                    )}
                    <p className="text-xs text-gray-500">To {fmtPhone(c.toNumber)} · placed by {c.startedBy}{c.endedAt ? ` · ended ${fmtTime(c.endedAt)}` : ""}</p>
                    <details className="text-xs text-gray-500"><summary className="cursor-pointer">Task Sona was given</summary><p className="mt-1 whitespace-pre-wrap text-gray-600">{c.task}</p></details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
