"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Clock, Zap, Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  body: string;
}
export type DelayUnit = "minutes" | "hours" | "days";
export interface DripStep {
  body: string;
  delayValue: number;
  delayUnit: DelayUnit;
}
const UNIT_MINUTES: Record<DelayUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Convert stored delayMinutes back to the largest clean value+unit for editing. */
export function minutesToStepDelay(min: number): { delayValue: number; delayUnit: DelayUnit } {
  if (min > 0 && min % 1440 === 0) return { delayValue: min / 1440, delayUnit: "days" };
  if (min > 0 && min % 60 === 0) return { delayValue: min / 60, delayUnit: "hours" };
  return { delayValue: min, delayUnit: "minutes" };
}

const LEAD_TYPES = [
  { value: "quote", label: "Quote Form" },
  { value: "manual", label: "Manual" },
  { value: "meta", label: "Meta Ads" },
  { value: "outofarea", label: "Out of Area" },
  { value: "commercial", label: "Commercial" },
];

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

interface DripFormProps {
  mode: "create" | "edit";
  campaignId?: string;
  initial?: { name: string; leadTypes: string[]; stopOnReply: boolean; steps: DripStep[] };
}

export function DripForm({ mode, campaignId, initial }: DripFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [leadTypes, setLeadTypes] = useState<string[]>(initial?.leadTypes ?? ["quote"]);
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [steps, setSteps] = useState<DripStep[]>(initial?.steps ?? [{ body: "", delayValue: 0, delayUnit: "days" }]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/message-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const updateStep = (i: number, patch: Partial<DripStep>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const addStep = () => setSteps((s) => [...s, { body: "", delayValue: 3, delayUnit: "days" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Give the drip a name.");
    if (leadTypes.length === 0) return setError("Pick at least one trigger lead type.");
    if (!steps.some((s) => s.body.trim())) return setError("Add at least one message.");
    setSaving(true);
    try {
      const payload = {
        type: "drip",
        name: name.trim(),
        leadTypes,
        stopOnReply,
        steps: steps
          .filter((s) => s.body.trim())
          .map((s) => ({ body: s.body.trim(), delayMinutes: Math.max(0, Math.round(s.delayValue * UNIT_MINUTES[s.delayUnit])) })),
      };
      const res = await fetch(mode === "edit" ? `/api/admin/campaigns/${campaignId}` : "/api/admin/campaigns", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) router.push("/admin/campaigns");
      else setError(data.error || "Failed to save drip");
    } catch {
      setError("Failed to save drip");
    } finally {
      setSaving(false);
    }
  };

  const chip = (a: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border cursor-pointer transition-colors ${
      a ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/campaigns" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{mode === "edit" ? "Edit Drip Campaign" : "New Drip Campaign"}</h1>
          <p className="text-navy-600 text-sm mt-1">New matching leads are auto-enrolled and messaged over time.</p>
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">1. Trigger</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Drip name (internal)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <div>
          <p className="text-sm text-gray-500 mb-2">Enroll new leads of type</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_TYPES.map((t) => (
              <button key={t.value} onClick={() => setLeadTypes(toggle(leadTypes, t.value))} className={chip(leadTypes.includes(t.value))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={stopOnReply} onChange={(e) => setStopOnReply(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          Stop the sequence for a lead once they reply
        </label>
      </div>

      {/* Sequence */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">2. Message sequence</h2>
        {steps.map((step, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-navy-900">
                {i === 0 ? <Zap className="w-4 h-4 text-teal-600" /> : <Clock className="w-4 h-4 text-gray-400" />}
                Message {i + 1}
                {i === 0 ? (
                  <span className="text-xs text-gray-500 font-normal">· sent immediately on enrollment</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500 font-normal">
                    · send
                    <input
                      type="number"
                      min={0}
                      value={step.delayValue}
                      onChange={(e) => updateStep(i, { delayValue: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                      className="w-14 px-2 py-0.5 text-xs border border-gray-200 rounded"
                    />
                    <select
                      value={step.delayUnit}
                      onChange={(e) => updateStep(i, { delayUnit: e.target.value as DelayUnit })}
                      className="px-1.5 py-0.5 text-xs border border-gray-200 rounded bg-white"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    after the previous
                  </span>
                )}
              </span>
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <textarea
              value={step.body}
              onChange={(e) => updateStep(i, { body: e.target.value })}
              rows={3}
              placeholder="Message…  Use {{firstName}}, {{zipCode}} or {{numberOfDogs}} to personalize."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {templates.length > 0 && (
              <select
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) updateStep(i, { body: t.body });
                  e.target.value = "";
                }}
                defaultValue=""
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
              >
                <option value="" disabled>
                  Insert a template…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        <button onClick={addStep} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-navy-900 text-sm rounded-lg hover:bg-gray-50">
          <Plus className="w-4 h-4" />
          Add message
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create drip"}
      </button>
    </div>
  );
}
