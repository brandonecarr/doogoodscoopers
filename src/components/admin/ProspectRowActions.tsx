"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, ArrowRightCircle, Archive, ArchiveRestore, Loader2, Pencil } from "lucide-react";
import Link from "next/link";

export function ProspectRowActions({ id, status, hasContact }: { id: string; status: string; hasContact: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<"attempt" | "archive" | null>(null);
  const [note, setNote] = useState("");

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const r = await fetch(`/api/admin/commercial-prospects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const d = await r.json(); if (!r.ok || !d.success) { alert(d.error || "Could not update"); return; }
      setNoteFor(null); setNote(""); router.refresh();
    } finally { setBusy(null); }
  }
  async function convert() {
    if (!confirm("Convert this prospect to a commercial lead? It moves to the Commercial Leads list and opens there.")) return;
    setBusy("convert");
    try {
      const r = await fetch(`/api/admin/commercial-prospects/${id}/convert`, { method: "POST" });
      const d = await r.json(); if (!r.ok || !d.success) { alert(d.error || "Could not convert"); return; }
      router.push(`/admin/leads/commercial/${d.id}`);
    } finally { setBusy(null); }
  }
  const btn = "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50";
  if (noteFor) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteFor === "attempt" ? "What happened? (optional)" : "Reason (optional)"} className="w-56 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          onKeyDown={(e) => { if (e.key === "Enter") patch(noteFor, { note }); if (e.key === "Escape") setNoteFor(null); }} />
        <button onClick={() => patch(noteFor, { note })} disabled={!!busy} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}</button>
        <button onClick={() => setNoteFor(null)} className={`${btn} text-gray-500 hover:bg-gray-100`}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {status === "ARCHIVED" ? (
        <button onClick={() => patch("unarchive")} disabled={!!busy} className={`${btn} bg-teal-50 text-teal-700 hover:bg-teal-100`}><ArchiveRestore className="w-3.5 h-3.5" /> Restore</button>
      ) : status === "CONVERTED" ? (
        <span className="text-xs text-gray-500">Converted</span>
      ) : (<>
        <button onClick={() => setNoteFor("attempt")} disabled={!!busy} className={`${btn} bg-blue-50 text-blue-700 hover:bg-blue-100`}><PhoneCall className="w-3.5 h-3.5" /> Log call</button>
        <button onClick={convert} disabled={!!busy || !hasContact} title={hasContact ? "" : "Add a phone or email first"} className={`${btn} bg-green-50 text-green-700 hover:bg-green-100`}>{busy === "convert" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightCircle className="w-3.5 h-3.5" />} Convert to lead</button>
        <button onClick={() => setNoteFor("archive")} disabled={!!busy} className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}><Archive className="w-3.5 h-3.5" /> Archive</button>
      </>)}
      {status !== "CONVERTED" && <Link href={`/admin/leads/commercial/call-list/${id}/edit`} className={`${btn} text-gray-500 hover:bg-gray-100`}><Pencil className="w-3.5 h-3.5" /> Edit</Link>}
    </div>
  );
}
