"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, Mail, Check, Ban, RotateCcw, Trash2 } from "lucide-react";

interface Row {
  id: string; email: string; name: string;
  status: "invited" | "active" | "inactive";
  invitedAt: string | null; lastLoginAt: string | null; createdAt: string;
}

const STATUS_STYLE: Record<Row["status"], string> = {
  active: "bg-green-100 text-green-800",
  invited: "bg-amber-100 text-amber-800",
  inactive: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<Row["status"], string> = { active: "Active", invited: "Invited", inactive: "Inactive" };

export function CanvasserTeamManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/canvassers");
      if (res.ok) setRows((await res.json()).canvassers ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/canvassers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ kind: "err", text: data.error || "Couldn't add canvasser." }); return; }
      setName(""); setEmail("");
      setMsg(data.invited ? { kind: "ok", text: `Invite emailed to ${data.canvasser.email}.` } : { kind: "err", text: `Added, but the invite email failed: ${data.inviteError || "unknown"}. Use Resend.` });
      await load();
    } catch {
      setMsg({ kind: "err", text: "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, action: "resend" | "deactivate" | "activate" | "delete") => {
    if (action === "delete" && !confirm("Delete this canvasser account? Their dropped pins and leads stay in the system.")) return;
    setRowBusy(id); setMsg(null);
    try {
      const res = await fetch("/api/admin/canvassers", {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "delete" ? { id } : { id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) { setMsg({ kind: "err", text: data.error || "Action failed." }); }
      else if (action === "resend") setMsg({ kind: "ok", text: "Invite resent." });
      await load();
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="dgs-card p-4">
      <h3 className="text-[13px] font-bold text-ink mb-3">Canvasser accounts</h3>

      {/* Add */}
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "#6D3EF0" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Add &amp; invite
        </button>
      </form>
      {msg && <p className={`text-[12px] mb-3 ${msg.kind === "ok" ? "text-green-700" : "text-rose-600"}`}>{msg.text}</p>}

      {/* List */}
      {loading ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted">No canvasser accounts yet. Add one above — they&apos;ll get an email to set their password.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-navy-900 truncate">{r.name} <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span></p>
                <p className="text-[12px] text-gray-500 truncate">{r.email}{r.lastLoginAt ? " · signed in" : r.status === "invited" ? " · invite sent" : ""}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {r.status !== "active" && (
                  <button onClick={() => act(r.id, "resend")} disabled={rowBusy === r.id} title="Resend invite" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
                )}
                {r.status === "inactive" ? (
                  <button onClick={() => act(r.id, "activate")} disabled={rowBusy === r.id} title="Reactivate" className="p-1.5 rounded-lg hover:bg-gray-100 text-green-600"><Check className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => act(r.id, "deactivate")} disabled={rowBusy === r.id} title="Deactivate (blocks login)" className="p-1.5 rounded-lg hover:bg-gray-100 text-amber-600"><Ban className="w-4 h-4" /></button>
                )}
                <button onClick={() => act(r.id, "delete")} disabled={rowBusy === r.id} title="Delete account" className="p-1.5 rounded-lg hover:bg-gray-100 text-rose-600"><Trash2 className="w-4 h-4" /></button>
                {rowBusy === r.id && <RotateCcw className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
