"use client";

import { useEffect, useState } from "react";
import { PhoneCall, Loader2, Check, Sparkles } from "lucide-react";

interface Intel {
  isServiceInquiry: boolean;
  firstName: string;
  lastName: string;
  email: string;
  zipCode: string;
  address: string;
  numberOfDogs: string;
  frequency: string;
  interestLevel: string;
  objections: string;
  nextStep: string;
  summary: string;
}

const FIELDS: [keyof Intel, string][] = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["zipCode", "Zip code"],
  ["address", "Address"],
  ["numberOfDogs", "Number of dogs"],
  ["frequency", "Frequency"],
];

// AI call notes: settings + a dry-run preview against a real past call.
export function CallIntelCard() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [createLeads, setCreateLeads] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [phone, setPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ intel: Intel | null; transcript: string; call: { duration?: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    fetch("/api/admin/app-settings?prefix=calls.ai.")
      .then((r) => (r.ok ? r.json() : { settings: {} }))
      .then((d) => {
        const s = d.settings || {};
        if (s["calls.ai.enabled"] !== undefined) setEnabled(s["calls.ai.enabled"] !== "false");
        if (s["calls.ai.createLeads"] !== undefined) setCreateLeads(s["calls.ai.createLeads"] === "true");
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: { enabled?: boolean; createLeads?: boolean }) {
    const e = next.enabled ?? enabled;
    const c = next.createLeads ?? createLeads;
    setEnabled(e);
    setCreateLeads(c);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { "calls.ai.enabled": e ? "true" : "false", "calls.ai.createLeads": c ? "true" : "false" },
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setError(null);
    setResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/admin/calls/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json();
      if (res.ok) setResult(d);
      else setError(d.error || "Couldn't analyze that call.");
    } catch {
      setError("Couldn't analyze that call.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 mr-auto">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <PhoneCall className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900 leading-none flex items-center gap-1.5">
              AI call notes <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </p>
            <p className="text-xs text-gray-500 mt-1">
              After each call, reads the transcript and files what the caller said into the lead.
            </p>
          </div>
        </div>

        {!loaded ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={enabled} onChange={(e) => save({ enabled: e.target.checked })} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Take notes &amp; fill blanks
            </label>
            <label className={`flex items-center gap-2 text-sm text-gray-700 ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
              <input type="checkbox" checked={createLeads} onChange={(e) => save({ createLeads: e.target.checked })} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Create leads from unknown callers
            </label>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            {saved && <Check className="w-4 h-4 text-green-600" />}
          </>
        )}
      </div>

      {/* Dry-run preview */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2">
          Try it on a real past call — this only shows you what it would extract, it saves nothing.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number that called you"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={test}
            disabled={testing || !phone.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-50 text-sm font-medium"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Preview extraction
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        {result?.intel && (
          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
            <p className="text-sm text-navy-900">{result.intel.summary}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {FIELDS.map(([k, label]) =>
                String(result.intel![k] || "").trim() ? (
                  <span key={k} className="text-gray-700">
                    <span className="text-gray-400">{label}:</span> <strong>{String(result.intel![k])}</strong>
                  </span>
                ) : null
              )}
              <span className="text-gray-700">
                <span className="text-gray-400">Interest:</span> <strong>{result.intel.interestLevel.replace("_", " ")}</strong>
              </span>
            </div>
            {result.intel.nextStep && <p className="text-xs text-gray-600">Next step: {result.intel.nextStep}</p>}
            {result.intel.objections && <p className="text-xs text-gray-600">Concerns: {result.intel.objections}</p>}
            {!result.intel.isServiceInquiry && (
              <p className="text-xs text-amber-700">Not a service inquiry — this call would not create a lead.</p>
            )}
            <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-teal-600 hover:underline">
              {showTranscript ? "Hide" : "Show"} transcript
            </button>
            {showTranscript && (
              <pre className="text-[11px] whitespace-pre-wrap text-gray-600 max-h-64 overflow-y-auto bg-white rounded p-2 border border-gray-100">
                {result.transcript}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
