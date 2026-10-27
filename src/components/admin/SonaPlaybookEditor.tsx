"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Check, RotateCcw } from "lucide-react";
import { compilePlaybook, fillTokens, parsePlaybook, DEFAULT_SONA_PLAYBOOKS, SONA_LEAD_TYPES, SONA_LEAD_TYPE_LABEL, SONA_MAX_TASK, SONA_TOKENS, type SonaPlaybook, type SonaPlaybookLeadType } from "@/lib/sona-playbook";
import { SAMPLE_TOKENS } from "@/lib/sample-tokens";

const SAMPLE_VARS: Record<string, string> = {
  ...SAMPLE_TOKENS,
  quoteDetails: "2 dogs, weekly service in Fontana 92336", quoteDetailsClause: " for 2 dogs, weekly service in Fontana 92336",
  whereClause: " from Fontana 92336", rateSentence: " Their quoted rate is $89 per month.",
};

type Lists = "collect" | "facts" | "never";

/**
 * Branching editor for a Sona outbound playbook: opening, goal, what to collect,
 * "if they say… → Sona should…" branches, facts, rules, wrap-up. Compiles live into
 * the instruction Sona will receive, with the 2,000-character budget shown.
 * Stored per lead type as JSON in AppSetting sona.playbook.<TYPE>.
 */
export function SonaPlaybookEditor() {
  const [type, setType] = useState<SonaPlaybookLeadType>("QUOTE_FORM");
  const [books, setBooks] = useState<Record<string, SonaPlaybook>>({});
  const [custom, setCustom] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/app-settings?prefix=sona.playbook.", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const s: Record<string, string> = d.settings || {};
      const next: Record<string, SonaPlaybook> = {}; const isCustom: Record<string, boolean> = {};
      for (const t of SONA_LEAD_TYPES) { const pb = parsePlaybook(s[`sona.playbook.${t}`]); next[t] = pb ?? structuredClone(DEFAULT_SONA_PLAYBOOKS[t]); isCustom[t] = !!pb; }
      setBooks(next); setCustom(isCustom);
    }).catch(() => setError("Couldn't load the playbooks.")).finally(() => setLoading(false));
  }, []);

  const pb = books[type];
  const update = (patch: Partial<SonaPlaybook>) => { setBooks((b) => ({ ...b, [type]: { ...b[type], ...patch } })); setDirty(true); setSaved(false); };
  const setList = (key: Lists, items: string[]) => update({ [key]: items } as Partial<SonaPlaybook>);
  const setBranches = (branches: SonaPlaybook["branches"]) => update({ branches });

  const compiled = useMemo(() => (pb ? compilePlaybook(pb) : ""), [pb]);
  const preview = useMemo(() => fillTokens(compiled, SAMPLE_VARS), [compiled]);
  const over = preview.length > SONA_MAX_TASK;

  const save = async () => {
    if (!pb) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/admin/app-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { [`sona.playbook.${type}`]: JSON.stringify(pb) } }) });
      if (!r.ok) { setError("Could not save."); return; }
      setCustom((c) => ({ ...c, [type]: true })); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!confirm("Replace this playbook with the built-in one? Your edits for this lead type are discarded.")) return;
    await fetch("/api/admin/app-settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: `sona.playbook.${type}` }) });
    setBooks((b) => ({ ...b, [type]: structuredClone(DEFAULT_SONA_PLAYBOOKS[type]) })); setCustom((c) => ({ ...c, [type]: false })); setDirty(false);
  };

  const input = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white";
  const small = "inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30";

  const ListEditor = ({ title, hint, items, onChange, placeholder }: { title: string; hint: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) => (
    <div className="dgs-card p-5">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className={input} />
            <button type="button" className={small} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...items, ""])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><Plus className="w-3.5 h-3.5" /> Add</button>
    </div>
  );

  if (loading || !pb) return <div className="dgs-card p-6 text-sm text-gray-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading playbooks…</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-3.5 items-start">
      <div className="space-y-3.5">
        <div className="dgs-card p-3 flex flex-wrap items-center gap-2">
          {SONA_LEAD_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => { if (dirty && !confirm("Switch lead type without saving? Unsaved edits are lost.")) return; setType(t); setDirty(false); }}
              className={`px-3 py-1.5 text-sm rounded-lg border ${t === type ? "bg-navy-900 text-white border-navy-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
              {SONA_LEAD_TYPE_LABEL[t]}{custom[t] ? "" : <span className="ml-1 text-[10px] opacity-70">built-in</span>}
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"><RotateCcw className="w-3.5 h-3.5" /> Built-in</button>
          <button type="button" onClick={save} disabled={saving || !dirty || over} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null} {saved ? "Saved" : "Save playbook"}
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="dgs-card p-5 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Opening</span>
            <p className="text-xs text-gray-500 mb-1">Who Sona is and why it's calling. The lead hears this first.</p>
            <textarea value={pb.opening} onChange={(e) => update({ opening: e.target.value })} rows={3} className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Goal</span>
            <p className="text-xs text-gray-500 mb-1">What a successful call achieves.</p>
            <textarea value={pb.goal} onChange={(e) => update({ goal: e.target.value })} rows={2} className={input} />
          </label>
          <p className="text-xs text-gray-500">Tokens: {SONA_TOKENS.map((t) => <code key={t.token} title={t.means} className="mr-1.5 px-1 py-0.5 rounded bg-gray-100 text-[11px]">{t.token}</code>)}</p>
        </div>

        <ListEditor title="Find out" hint="What Sona should collect, in order." items={pb.collect} onChange={(v) => setList("collect", v)} placeholder="e.g. The best day of the week" />

        <div className="dgs-card p-5">
          <h3 className="text-sm font-semibold text-navy-900">Branches</h3>
          <p className="text-xs text-gray-500 mb-2">If the lead says this… then Sona should do this. Checked in order; put the most common first.</p>
          <ul className="space-y-2">
            {pb.branches.map((b, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-3 bg-gray-50/60">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">If they say</span>
                    <input value={b.when} onChange={(e) => setBranches(pb.branches.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)))} placeholder="e.g. They ask about price" className={input} /></label>
                  <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Then Sona should</span>
                    <textarea value={b.then} onChange={(e) => setBranches(pb.branches.map((x, j) => (j === i ? { ...x, then: e.target.value } : x)))} rows={2} placeholder="e.g. Repeat the quoted rate and mention there's no contract" className={input} /></label>
                  <div className="flex md:flex-col gap-1 pt-4">
                    <button type="button" className={small} disabled={i === 0} onClick={() => { const a = [...pb.branches]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setBranches(a); }} aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" className={small} disabled={i === pb.branches.length - 1} onClick={() => { const a = [...pb.branches]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setBranches(a); }} aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" className={small} onClick={() => setBranches(pb.branches.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setBranches([...pb.branches, { when: "", then: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><Plus className="w-3.5 h-3.5" /> Add branch</button>
        </div>

        <ListEditor title="Facts Sona may share" hint="Only these. Anything else gets “Brandon or Valerie will follow up.”" items={pb.facts} onChange={(v) => setList("facts", v)} placeholder="e.g. No contracts; cancel any time" />
        <ListEditor title="Rules" hint="Hard limits Sona must never cross." items={pb.never} onChange={(v) => setList("never", v)} placeholder="e.g. Never book a specific date or time" />

        <div className="dgs-card p-5">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Wrap-up</span>
            <p className="text-xs text-gray-500 mb-1">How Sona ends the call.</p>
            <textarea value={pb.wrapUp} onChange={(e) => update({ wrapUp: e.target.value })} rows={2} className={input} />
          </label>
        </div>
      </div>

      <div className="dgs-card p-5 xl:sticky xl:top-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-navy-900">What Sona receives</h3>
          <span className={`text-xs font-medium ${over ? "text-red-700" : preview.length > SONA_MAX_TASK * 0.9 ? "text-amber-700" : "text-gray-500"}`}>{preview.length.toLocaleString()} / {SONA_MAX_TASK.toLocaleString()}</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">Preview with a sample lead (Jamie Lee, 2 dogs, weekly, Fontana). Real calls fill in the actual lead.</p>
        {over && <p className="text-xs text-red-700 mb-2">Over Quo's 2,000-character limit. Trim a branch or a fact before saving.</p>}
        <p className="text-[13px] leading-relaxed text-gray-800 whitespace-pre-wrap">{preview}</p>
      </div>
    </div>
  );
}
