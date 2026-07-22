"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Users, Loader2 } from "lucide-react";

interface Recipient {
  leadType: string;
  leadId: string;
  name: string | null;
  phone: string;
  status: string | null;
  grade: string | null;
}
interface Template {
  id: string;
  name: string;
  body: string;
}

const LEAD_TYPES = [
  { value: "quote", label: "Quote Form" },
  { value: "manual", label: "Manual" },
  { value: "meta", label: "Meta Ads" },
  { value: "outofarea", label: "Out of Area" },
  { value: "commercial", label: "Commercial" },
];
const STATUSES = ["NEW", "CONTACTED", "NO_ANSWER", "NOT_INTERESTED", "WAITING_FOR_SIGNUP", "CONVERTED"];
const GRADES = ["A", "B", "C", "D", "F"];

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
const key = (r: Recipient) => `${r.leadType}:${r.leadId}`;

export default function NewCampaignPage() {
  const router = useRouter();
  const [leadTypes, setLeadTypes] = useState<string[]>(["quote"]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [withinDays, setWithinDays] = useState<string>("");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/message-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  // Live preview whenever filters change (debounced).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (leadTypes.length === 0) {
      setRecipients([]);
      return;
    }
    setLoadingPreview(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/campaigns/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadTypes,
            statuses,
            grades,
            withinDays: withinDays ? parseInt(withinDays, 10) : undefined,
          }),
        });
        const data = await res.json();
        setRecipients(data.recipients || []);
        setExcluded(new Set());
      } finally {
        setLoadingPreview(false);
      }
    }, 400);
  }, [leadTypes, statuses, grades, withinDays]);

  const selected = useMemo(() => recipients.filter((r) => !excluded.has(key(r))), [recipients, excluded]);

  const handleSend = async () => {
    setError(null);
    if (!name.trim() || !body.trim()) return setError("Add a campaign name and message.");
    if (selected.length === 0) return setError("No recipients selected.");
    setSending(true);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          body: body.trim(),
          audienceFilter: { leadTypes, statuses, grades, withinDays: withinDays || null },
          recipients: selected.map((r) => ({ leadType: r.leadType, leadId: r.leadId, phone: r.phone, name: r.name })),
        }),
      });
      const data = await res.json();
      if (res.ok) router.push("/admin/campaigns");
      else setError(data.error || "Failed to create campaign");
    } catch {
      setError("Failed to create campaign");
    } finally {
      setSending(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border cursor-pointer transition-colors ${
      active ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/campaigns" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-navy-900">New Campaign</h1>
      </div>

      {/* Audience */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">1. Audience</h2>

        <div>
          <p className="text-sm text-gray-500 mb-2">Lead type</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_TYPES.map((t) => (
              <button key={t.value} onClick={() => setLeadTypes(toggle(leadTypes, t.value))} className={chip(leadTypes.includes(t.value))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-2">Status (any)</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatuses(toggle(statuses, s))} className={chip(statuses.includes(s))}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Grade (any)</p>
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button key={g} onClick={() => setGrades(toggle(grades, g))} className={chip(grades.includes(g))}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">In the last (days)</p>
            <input
              type="number"
              min={0}
              value={withinDays}
              onChange={(e) => setWithinDays(e.target.value)}
              placeholder="e.g. 14"
              className="w-28 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            2. Recipients
          </h2>
          <span className="text-sm font-medium text-navy-900">
            {loadingPreview ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              `${selected.length} selected / ${recipients.length} matched`
            )}
          </span>
        </div>
        {recipients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {leadTypes.length ? "No leads match these filters." : "Pick at least one lead type."}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {recipients.map((r) => {
              const k = key(r);
              const on = !excluded.has(k);
              return (
                <label key={k} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(k);
                        else next.delete(k);
                        return next;
                      })
                    }
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="flex-1 text-sm text-navy-900 truncate">{r.name || "Unknown"}</span>
                  <span className="text-xs text-gray-500">{r.phone}</span>
                  {r.status && <span className="text-[11px] text-gray-400">{r.status.replace(/_/g, " ")}</span>}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">3. Message</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name (internal)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {templates.length > 0 && (
          <select
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) setBody(t.body);
              e.target.value = "";
            }}
            defaultValue=""
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
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
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Your message…  Use {{firstName}}, {{zipCode}} or {{dogs}} to personalize."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSend}
          disabled={sending || selected.length === 0 || !name.trim() || !body.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Send className="w-4 h-4" />
          {sending ? "Queuing…" : `Send to ${selected.length}`}
        </button>
        <p className="text-xs text-gray-400">Messages send in the background (a few per second). You can leave this page.</p>
      </div>
    </div>
  );
}
