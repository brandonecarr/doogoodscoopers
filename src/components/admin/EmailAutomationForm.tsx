"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical } from "lucide-react";

type Unit = "minutes" | "hours" | "days";
interface Step { subject: string; templateId: string; html: string; delayValue: number; delayUnit: Unit }

const TRIGGERS = [
  { value: "new_subscribers", label: "New subscribers (welcome)" },
  { value: "new_customers", label: "New customers (welcome)" },
  { value: "former_customers", label: "Former customers (win-back)" },
  { value: "quote", label: "New quote leads (nurture)" },
  { value: "ad", label: "New Meta leads (nurture)" },
];

const toMinutes = (v: number, u: Unit) => v * (u === "days" ? 1440 : u === "hours" ? 60 : 1);
export function minutesToStep(min: number): { delayValue: number; delayUnit: Unit } {
  if (min > 0 && min % 1440 === 0) return { delayValue: min / 1440, delayUnit: "days" };
  if (min > 0 && min % 60 === 0) return { delayValue: min / 60, delayUnit: "hours" };
  return { delayValue: min, delayUnit: "minutes" };
}

export default function EmailAutomationForm({ automationId }: { automationId?: string }) {
  const router = useRouter();
  const isNew = !automationId;
  const [name, setName] = useState("");
  const [types, setTypes] = useState<string[]>(["new_customers"]);
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<Step[]>([{ subject: "", templateId: "", html: "", delayValue: 0, delayUnit: "days" }]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/email-templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setTemplates(d.templates || [])).catch(() => {});
    if (isNew) return;
    fetch(`/api/admin/email-automations/${automationId}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.automation) {
        setName(d.automation.name);
        setTypes(d.automation.trigger?.types || []);
        setActive(d.automation.active);
        setSteps((d.steps || []).map((s: { subject: string; templateId: string | null; html: string | null; delayMinutes: number }) => ({ subject: s.subject, templateId: s.templateId || "", html: s.html || "", ...minutesToStep(s.delayMinutes) })));
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [automationId, isNew]);

  const toggleType = (v: string) => setTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const setStep = (i: number, patch: Partial<Step>) => setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((p) => [...p, { subject: "", templateId: "", html: "", delayValue: 2, delayUnit: "days" }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Name your automation.");
    if (types.length === 0) return setError("Pick at least one trigger.");
    if (steps.some((s) => !s.subject.trim() || (!s.templateId && !s.html.trim()))) return setError("Each step needs a subject and a template (or HTML).");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), active, trigger: { types },
        steps: steps.map((s) => ({ subject: s.subject.trim(), templateId: s.templateId || undefined, html: s.templateId ? undefined : s.html, delayMinutes: toMinutes(s.delayValue || 0, s.delayUnit) })),
      };
      const res = await fetch(isNew ? "/api/admin/email-automations" : `/api/admin/email-automations/${automationId}`, {
        method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) router.push("/admin/email/automations");
      else setError(d.error || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>;

  return (
    <div className="space-y-6 pb-24 lg:pb-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/email/automations" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
        <h1 className="text-2xl font-bold text-navy-900">{isNew ? "New Automation" : "Edit Automation"}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">1. Trigger</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Automation name (internal)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
        <div>
          <p className="text-sm text-gray-500 mb-2">Enroll new contacts of type</p>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map((t) => (
              <button key={t.value} type="button" onClick={() => toggleType(t.value)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${types.includes(t.value) ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          Active (enroll & send). Turn off to pause.
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">2. Email sequence</h2>
        {steps.map((s, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
              <GripVertical className="w-4 h-4 text-gray-300" /> Email {i + 1}
              <span className="text-xs text-gray-400 font-normal">{i === 0 ? "· sent when they join" : "· after the previous email"}</span>
              {steps.length > 1 && <button onClick={() => removeStep(i)} className="ml-auto p-1 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
            <input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Subject" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={s.templateId || (s.html ? "__html" : "")} onChange={(e) => { const v = e.target.value; setStep(i, v === "__html" ? { templateId: "" } : { templateId: v === "" ? "" : v, html: "" }); }} className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                <option value="">Choose a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="__html">Custom HTML</option>
              </select>
              {i > 0 || s.delayValue > 0 ? (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-gray-500">after</span>
                  <input type="number" min={0} value={s.delayValue} onChange={(e) => setStep(i, { delayValue: parseInt(e.target.value) || 0 })} className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-lg" />
                  <select value={s.delayUnit} onChange={(e) => setStep(i, { delayUnit: e.target.value as Unit })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="minutes">min</option><option value="hours">hrs</option><option value="days">days</option>
                  </select>
                </div>
              ) : null}
            </div>
            {!s.templateId && (
              <textarea value={s.html} onChange={(e) => setStep(i, { html: e.target.value })} rows={4} placeholder="Custom HTML (or pick a template above). {{firstName}} personalizes." className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            )}
          </div>
        ))}
        <button onClick={addStep} className="flex items-center gap-1.5 text-sm text-teal-600 hover:underline"><Plus className="w-4 h-4" /> Add email</button>
        {templates.length === 0 && <p className="text-xs text-amber-700">Tip: <Link href="/admin/email/templates/new" className="underline">design a template</Link> first for the best-looking emails.</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save automation
      </button>
    </div>
  );
}
