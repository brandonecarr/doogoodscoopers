"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Check } from "lucide-react";

const TZ_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/New_York", label: "Eastern" },
];

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

export function SendingHoursCard() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/app-settings?prefix=drips.window.")
      .then((r) => (r.ok ? r.json() : { settings: {} }))
      .then((d) => {
        const s = d.settings || {};
        if (s["drips.window.enabled"] !== undefined) setEnabled(s["drips.window.enabled"] !== "false");
        if (s["drips.window.startHour"]) setStartHour(parseInt(s["drips.window.startHour"], 10));
        if (s["drips.window.endHour"]) setEndHour(parseInt(s["drips.window.endHour"], 10));
        if (s["drips.window.timezone"]) setTimezone(s["drips.window.timezone"]);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            "drips.window.enabled": enabled ? "true" : "false",
            "drips.window.startHour": String(startHour),
            "drips.window.endHour": String(endHour),
            "drips.window.timezone": timezone,
          },
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

  const invalid = startHour >= endHour;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 mr-auto">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900 leading-none">Drip sending hours</p>
            <p className="text-xs text-gray-500 mt-1">Automated drip texts only go out during these hours — no 3am messages.</p>
          </div>
        </div>

        {!loaded ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Enforce
            </label>

            <div className={`flex items-center gap-2 text-sm ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
              <span className="text-gray-500">From</span>
              <select value={startHour} onChange={(e) => setStartHour(parseInt(e.target.value, 10))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm">
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <span className="text-gray-500">to</span>
              <select value={endHour} onChange={(e) => setEndHour(parseInt(e.target.value, 10))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm">
                {TZ_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={save}
              disabled={saving || invalid}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
              title={invalid ? "Start must be before end" : undefined}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? "Saved" : "Save"}
            </button>
          </>
        )}
      </div>
      {loaded && invalid && <p className="text-xs text-red-600 mt-2">Start time must be earlier than end time.</p>}
    </div>
  );
}
