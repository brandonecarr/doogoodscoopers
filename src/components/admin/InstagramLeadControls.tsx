"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Archive, ArchiveRestore, Trash2 } from "lucide-react";

const STATUSES = ["NEW", "CONTACTED", "NO_ANSWER", "NOT_INTERESTED", "WAITING_FOR_SIGNUP", "CONVERTED"] as const;

export function InstagramLeadControls({
  id,
  initial,
}: {
  id: string;
  initial: { status: string; grade: string | null; followupDate: string | null; notes: string | null; archived: boolean };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status);
  const [grade, setGrade] = useState(initial.grade || "");
  const [followupDate, setFollowupDate] = useState(initial.followupDate ? initial.followupDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    try {
      await fetch(`/api/admin/instagram-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this Instagram lead? This can't be undone.")) return;
    setBusy("delete");
    try {
      await fetch(`/api/admin/instagram-leads/${id}`, { method: "DELETE" });
      router.push("/admin/leads");
    } finally {
      setBusy(null);
    }
  };

  const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500";

  return (
    <div className="dgs-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-navy-900">Manage lead</h2>

      <label className="block">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</span>
        <select className={sel + " mt-1"} value={status} onChange={(e) => { setStatus(e.target.value); patch({ status: e.target.value }, "status"); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</span>
          <select className={sel + " mt-1"} value={grade} onChange={(e) => { setGrade(e.target.value); patch({ grade: e.target.value || null }, "grade"); }}>
            <option value="">—</option>
            {["A", "B", "C", "D", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</span>
          <input type="date" className={sel + " mt-1"} value={followupDate} onChange={(e) => { setFollowupDate(e.target.value); patch({ followupDate: e.target.value || null }, "followup"); }} />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</span>
        <textarea rows={4} className={sel + " mt-1 resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />
      </label>
      <button onClick={() => patch({ notes }, "notes")} disabled={busy === "notes"} className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
        {busy === "notes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save notes
      </button>

      <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
        <button onClick={() => patch({ archived: !initial.archived }, "archive")} disabled={busy === "archive"} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          {initial.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          {initial.archived ? "Unarchive" : "Archive"}
        </button>
        <button onClick={remove} disabled={busy === "delete"} className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm ml-auto">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    </div>
  );
}
