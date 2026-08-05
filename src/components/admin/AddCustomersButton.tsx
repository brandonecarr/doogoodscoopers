"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Search, Check, X } from "lucide-react";

interface EligibleCustomer { id: string; name: string; phone: string; email: string; plan: string }

// Campaign-detail control: search customers and add several at once. The search
// endpoint already excludes review-completed + already-enrolled customers.
export function AddCustomersButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EligibleCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/eligible-customers?search=${encodeURIComponent(q)}`);
      setRows(res.ok ? (await res.json()).customers ?? [] : []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(search), 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [open, search, load]);

  const openModal = () => { setOpen(true); setSearch(""); setSelected(new Set()); setFlash(null); };
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const add = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enroll-customers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [...selected] }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash(`Added ${d.added}${d.skipped?.length ? `, skipped ${d.skipped.length}` : ""}.`);
        setSelected(new Set());
        await load(search);      // refresh the picker (enrolled ones drop out)
        router.refresh();        // refresh the recipients table on the page
      } else setFlash(d.error || "Couldn't add customers.");
    } catch { setFlash("Couldn't add customers."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <button onClick={openModal} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
        <UserPlus className="w-4 h-4" /> Add customers
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-navy-900">Add customers</h2>
                <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Review-completed customers and anyone already enrolled are hidden.</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">{search ? "No eligible customers match." : "No eligible customers."}</p>
              ) : (
                rows.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-50 ${on ? "bg-teal-50" : ""}`}>
                      <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-teal-600 border-teal-600" : "border-gray-300"}`}>
                        {on && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-navy-900 truncate">{c.name}</span>
                        <span className="block text-xs text-gray-500 truncate">{c.phone}{c.plan ? ` · ${c.plan}` : ""}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center gap-3">
              {flash && <span className="text-xs font-semibold text-teal-600">{flash}</span>}
              <button onClick={add} disabled={selected.size === 0 || saving}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Add {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
