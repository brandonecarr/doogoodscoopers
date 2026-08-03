"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Instagram, Pencil, Save, X } from "lucide-react";

export interface IgCampaign {
  id: string;
  name: string;
  mediaId: string | null;
  keywords: string[];
  matchType: string;
  dmText: string;
  publicReply: string | null;
  active: boolean;
  matchedCount: number;
  sentCount: number;
  failedCount: number;
}

const EMPTY = { name: "", keywords: "", matchType: "partial", mediaId: "", dmText: "", publicReply: "" };

export function InstagramManager({ campaigns }: { campaigns: IgCampaign[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(campaigns.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState(EMPTY);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const startNew = () => {
    setEditingId(null);
    setF(EMPTY);
    setErr(null);
    setOpen(true);
  };

  const startEdit = (c: IgCampaign) => {
    setEditingId(c.id);
    setF({
      name: c.name,
      keywords: c.keywords.join(", "),
      matchType: c.matchType,
      mediaId: c.mediaId || "",
      dmText: c.dmText,
      publicReply: c.publicReply || "",
    });
    setErr(null);
    setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
    setF(EMPTY);
    setErr(null);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: f.name,
        keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        matchType: f.matchType,
        mediaId: f.mediaId,
        dmText: f.dmText,
        publicReply: f.publicReply,
      };
      const res = await fetch(
        editingId ? `/api/admin/instagram-campaigns/${editingId}` : "/api/admin/instagram-campaigns",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (res.ok) {
        closeForm();
        router.refresh();
      } else {
        setErr(data.error || "Couldn't save campaign");
      }
    } catch {
      setErr("Couldn't save campaign");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: IgCampaign) => {
    await fetch(`/api/admin/instagram-campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  };

  const remove = async (c: IgCampaign) => {
    if (!confirm(`Delete the "${c.name}" campaign? Its send history is removed too.`)) return;
    await fetch(`/api/admin/instagram-campaigns/${c.id}`, { method: "DELETE" });
    router.refresh();
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
  const isEditing = editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => (open && !isEditing ? closeForm() : startNew())} className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>

      {open && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">
            {isEditing ? "Edit campaign" : "New comment → DM campaign"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign name</span>
              <input className={inputCls + " mt-1"} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Quote-link auto-DM" />
            </label>
            <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger keywords (comma-separated)</span>
              <input className={inputCls + " mt-1"} value={f.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="SCOOP, QUOTE, PRICE" />
            </label>
            <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Match</span>
              <select className={inputCls + " mt-1 bg-white"} value={f.matchType} onChange={(e) => set("matchType", e.target.value)}>
                <option value="partial">Contains the word</option>
                <option value="whole">Whole word only</option>
              </select>
            </label>
            <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Post / Reel media ID <span className="normal-case font-normal text-gray-400">(blank = any post)</span></span>
              <input className={inputCls + " mt-1"} value={f.mediaId} onChange={(e) => set("mediaId", e.target.value)} placeholder="e.g. 178414...  (optional)" />
            </label>
          </div>
          <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DM to send</span>
            <textarea rows={3} className={inputCls + " mt-1 resize-none"} value={f.dmText} onChange={(e) => set("dmText", e.target.value)} placeholder="Hi {username}! 🐾 Here's your free quote link: {link}" />
            <span className="text-[11px] text-gray-400">
              Use <code className="bg-gray-100 px-1 rounded">{"{username}"}</code> to greet them by handle, and{" "}
              <code className="bg-gray-100 px-1 rounded">{"{link}"}</code> for a tracked quote link — quotes from it are attributed to that commenter as an Instagram lead.
            </span>
          </label>
          <label className="block"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Public comment reply <span className="normal-case font-normal text-gray-400">(optional)</span></span>
            <input className={inputCls + " mt-1"} value={f.publicReply} onChange={(e) => set("publicReply", e.target.value)} placeholder="Just sent you a DM! 📩" />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditing ? "Save changes" : "Create campaign"}
            </button>
            <button onClick={closeForm} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {campaigns.map((c) => (
            <div key={c.id} className={`flex items-center gap-4 p-4 ${editingId === c.id ? "bg-teal-50/40" : ""}`}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center flex-shrink-0">
                <Instagram className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-navy-900 truncate">{c.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{c.mediaId ? "one post" : "any post"}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  Keywords: {c.keywords.join(", ")} · {c.sentCount} sent · {c.matchedCount} matched{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                </p>
              </div>
              <button onClick={() => toggle(c)} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {c.active ? "Active" : "Paused"}
              </button>
              <button onClick={() => startEdit(c)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(c)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
