"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Clock, Zap, Loader2, ArrowUp, ArrowDown, Mail, MessageSquare, Eye } from "lucide-react";
import { emailTextToHtml } from "@/lib/campaign-email";
import { winbackTemplate, WINBACK_CODE, WINBACK_FROM, LINK_PLACEHOLDER } from "@/lib/campaign-templates";

interface Template {
  id: string;
  name: string;
  body: string;
}
export type DelayUnit = "minutes" | "hours" | "days";
export interface DripStep {
  channel?: "sms" | "email";
  subject?: string;
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
  { value: "customers", label: "Customers (review requests)" },
  { value: "former_customers", label: "Former customers (win-back)" },
];
const FORMER = "former_customers";

interface FormerPerson {
  id: string; name: string; city: string | null; email: string | null; phone: string | null;
  smsDeclined: boolean; unsubscribed: boolean; optedOut: boolean;
  milesToNearestCustomer: number | null; farAway: boolean; emailEligible: boolean; smsEligible: boolean;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

interface DripFormProps {
  mode: "create" | "edit";
  campaignId?: string;
  initial?: {
    name: string; leadTypes: string[]; stopOnReply: boolean; steps: DripStep[]; channel?: string;
    excludeIds?: string[]; includeNew?: boolean; emailFromName?: string | null;
  };
}

export function DripForm({ mode, campaignId, initial }: DripFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [leadTypes, setLeadTypes] = useState<string[]>(initial?.leadTypes ?? ["quote"]);
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [channel, setChannel] = useState<string>(initial?.channel ?? "sms");
  const [steps, setSteps] = useState<DripStep[]>(initial?.steps ?? [{ body: "", delayValue: 0, delayUnit: "days" }]);
  const [templates, setTemplates] = useState<Template[]>([]);
  // Former-customer (win-back) audience
  const isFormer = leadTypes.includes(FORMER);
  const [people, setPeople] = useState<FormerPerson[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string> | null>(initial?.excludeIds ? new Set(initial.excludeIds) : null);
  const [includeNew, setIncludeNew] = useState(initial?.includeNew ?? false);
  const [showPeople, setShowPeople] = useState(false);
  const [fromName, setFromName] = useState(initial?.emailFromName ?? "");
  const [offerEnds, setOfferEnds] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return ymd(d); });
  const [signupLink, setSignupLink] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "launch">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/message-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isFormer || people) return;
    fetch("/api/admin/campaigns/former-customers")
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d: { people: FormerPerson[] }) => {
        setPeople(d.people || []);
        // New campaign: people who look out of the service area start unchecked.
        setExcluded((cur) => cur ?? new Set((d.people || []).filter((p) => p.farAway).map((p) => p.id)));
      })
      .catch(() => setPeople([]));
  }, [isFormer, people]);

  // Former customers are their own audience: the stop rules are the reverse of a lead's.
  const pickType = (v: string) =>
    setLeadTypes((cur) => (v === FORMER ? (cur.includes(FORMER) ? [] : [FORMER]) : toggle(cur.filter((x) => x !== FORMER), v)));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const loadWinback = () => {
    if (steps.some((s) => s.body.trim()) && !confirm("Replace the current messages with the 25%-off win-back sequence?")) return;
    setSteps(winbackTemplate(offerEnds, signupLink).map((t) => ({ channel: t.channel, subject: t.subject, body: t.body, delayValue: t.delayDays, delayUnit: "days" as DelayUnit })));
    if (!fromName.trim()) setFromName(WINBACK_FROM);
    if (!name.trim()) setName("Win-back: 25% off first month");
  };
  const hasEmailStep = steps.some((s) => s.channel === "email" && s.body.trim());
  const hasTextStep = steps.some((s) => s.channel !== "email" && s.body.trim());
  const chosen = (people || []).filter((p) => !excluded?.has(p.id));
  const reach = (p: FormerPerson) => (hasEmailStep && p.emailEligible) || (hasTextStep && p.smsEligible) || (!hasEmailStep && !hasTextStep && (p.emailEligible || p.smsEligible));
  const willEnroll = chosen.filter(reach);

  const updateStep = (i: number, patch: Partial<DripStep>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const addStep = () => setSteps((s) => [...s, { channel: "sms", subject: "", body: "", delayValue: 3, delayUnit: "days" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const save = async (asDraft = false) => {
    setError(null);
    if (!name.trim()) return setError("Give the drip a name.");
    // A draft can be incomplete; a live campaign needs a trigger + a message.
    if (!asDraft) {
      if (leadTypes.length === 0) return setError("Pick at least one trigger lead type.");
      if (!steps.some((s) => s.body.trim())) return setError("Add at least one message.");
      const noSubject = steps.findIndex((s) => s.channel === "email" && s.body.trim() && !s.subject?.trim());
      if (noSubject >= 0) return setError(`Message ${noSubject + 1} is an email and needs a subject.`);
      if (steps.some((s) => s.body.includes(LINK_PLACEHOLDER))) return setError("A message still has the placeholder signup link. Replace it with your real link.");
      if (isFormer && mode === "create" && !confirm(`Activate now? ${willEnroll.length} former customers will be enrolled and the first message starts going out right away (within sending hours).`)) return;
    }
    setSaving(asDraft ? "draft" : "launch");
    try {
      const payload = {
        type: "drip",
        draft: asDraft,
        name: name.trim(),
        leadTypes,
        stopOnReply,
        channel,
        steps: steps
          .filter((s) => s.body.trim())
          .map((s) => ({
            channel: s.channel === "email" ? "email" : "sms",
            subject: s.channel === "email" ? (s.subject || "").trim() : "",
            body: s.body.trim(),
            delayMinutes: Math.max(0, Math.round(s.delayValue * UNIT_MINUTES[s.delayUnit])),
          })),
        emailFromName: fromName.trim(),
        ...(isFormer ? { excludeIds: [...(excluded ?? [])], includeNew } : {}),
      };
      const res = await fetch(mode === "edit" ? `/api/admin/campaigns/${campaignId}` : "/api/admin/campaigns", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) router.push(asDraft && data.campaign?.id ? `/admin/campaigns/${data.campaign.id}` : "/admin/campaigns");
      else setError(data.error || "Failed to save drip");
    } catch {
      setError("Failed to save drip");
    } finally {
      setSaving(null);
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
          <p className="text-navy-600 text-sm mt-1">Matching people are auto-enrolled and messaged over time, by text, email or both.</p>
        </div>
      </div>

      {/* Trigger */}
      <div className="dgs-card p-6 space-y-4">
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
              <button key={t.value} onClick={() => pickType(t.value)} className={chip(leadTypes.includes(t.value))}>
                {t.label}
              </button>
            ))}
          </div>
          {leadTypes.includes("customers") && (
            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 mt-2">
              Enrolls each new Sweep&amp;Go customer once, after the delay you set — great for a review request a few days after their first cleanup. Use <code className="bg-white px-1 rounded">{"{{reviewLink}}"}</code> in the message to drop in your Google review link (set it under Reviews → Review sources).
            </p>
          )}

          {isFormer && (
            <div className="mt-3 border border-violet-100 bg-violet-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-navy-900">
                Enrolls <b>everyone who has already cancelled</b> when this campaign goes live. Each person stops automatically the moment they
                sign back up. Anyone who unsubscribed or texted STOP is skipped on that channel.
              </p>
              {people === null ? (
                <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading former customers…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-navy-900">
                      <b>{willEnroll.length}</b> of {people.length} former customers will be enrolled
                      <span className="text-gray-500"> · {chosen.filter((p) => p.emailEligible).length} by email · {chosen.filter((p) => p.smsEligible).length} by text</span>
                    </p>
                    <button type="button" onClick={() => setShowPeople((v) => !v)} className="text-sm font-medium text-violet-700 hover:underline">
                      {showPeople ? "Hide list" : "Review / remove people"}
                    </button>
                  </div>
                  {showPeople && (
                    <div className="max-h-72 overflow-y-auto bg-white border border-gray-100 rounded-lg divide-y divide-gray-50">
                      {people.map((p) => {
                        const notes = [
                          p.farAway ? `${p.milesToNearestCustomer} mi from nearest customer` : null,
                          !p.email ? "no email" : p.unsubscribed ? "unsubscribed from email" : null,
                          !p.phone ? "no phone" : p.optedOut ? "texted STOP" : p.smsDeclined ? "declined texts" : null,
                        ].filter(Boolean);
                        return (
                          <label key={p.id} className="flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={!excluded?.has(p.id)}
                              onChange={() => setExcluded((cur) => { const n = new Set(cur ?? []); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-900 flex-1 min-w-0 truncate">{p.name}{p.city ? <span className="text-gray-400"> · {p.city}</span> : null}</span>
                            {notes.length > 0 && <span className="text-xs text-amber-700 flex-shrink-0">{notes.join(" · ")}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {mode === "edit" && (
                    <p className="text-xs text-gray-500">Unchecking someone here keeps them from being enrolled. To stop someone already in the sequence, use Stop next to their name on the campaign page.</p>
                  )}
                </>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={includeNew} onChange={(e) => setIncludeNew(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                Also enroll customers who cancel after this campaign starts
              </label>
              <div className="pt-3 border-t border-violet-100 space-y-2">
                <p className="text-sm font-medium text-navy-900">Starter: 25% off the first month (3 emails + 2 texts over 14 days)</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-gray-600">Offer&apos;s last day
                    <input type="date" value={offerEnds} onChange={(e) => setOfferEnds(e.target.value)} className="block mt-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
                  </label>
                  <label className="text-xs text-gray-600 flex-1 min-w-[200px]">Signup link
                    <input value={signupLink} onChange={(e) => setSignupLink(e.target.value)} placeholder="https://…" className="block mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
                  </label>
                  <button type="button" onClick={loadWinback} disabled={!offerEnds} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                    Load messages
                  </button>
                </div>
                <p className="text-xs text-gray-500">Fills in the sequence below, where you can edit, add, remove and reorder every message. The messages use coupon code <b>{WINBACK_CODE}</b>, so create that code in Sweep&amp;Go (or change it in the messages) before activating.</p>
              </div>
            </div>
          )}

          {!isFormer && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">…or enroll on re-engagement — pick either, or both</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLeadTypes(toggle(leadTypes, "returning-meta"))}
                className={chip(leadTypes.includes("returning-meta") || leadTypes.includes("returning"))}>
                🔁 Returning Meta lead
              </button>
              <button type="button" onClick={() => setLeadTypes(toggle(leadTypes, "returning-quote"))}
                className={chip(leadTypes.includes("returning-quote") || leadTypes.includes("returning"))}>
                🔁 Returning quote-form lead
              </button>
            </div>
            {(leadTypes.includes("returning-meta") || leadTypes.includes("returning-quote") || leadTypes.includes("returning")) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                Enrolls a lead the moment they <b>re-submit</b> after already being in your system — a strong buying signal, worth different copy than a cold lead. Fires on re-engagement (not on creation), and re-triggers if someone who finished or stopped the sequence comes back again.
                {leadTypes.includes("returning") && (
                  <span className="block mt-1"><b>Note:</b> this campaign uses the older combined setting, which covers <b>both</b> sources. Tap a chip above to narrow it.</span>
                )}
              </p>
            )}
          </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={stopOnReply} onChange={(e) => setStopOnReply(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          Stop the sequence for a person once they reply to a text
        </label>

        {/* Send channel */}
        <div>
          <p className="text-sm font-medium text-navy-900 mb-1.5">Send text messages over</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setChannel("sms")} className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold border transition-colors"
              style={channel === "sms" ? { background: "#EFE9FF", color: "#6D3EF0", borderColor: "#6D3EF0" } : { color: "#6B7280", borderColor: "#E5E7EB" }}>
              💬 Text (SMS)
            </button>
            <button type="button" onClick={() => setChannel("messenger")} className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold border transition-colors"
              style={channel === "messenger" ? { background: "#E7F1FF", color: "#0084FF", borderColor: "#0084FF" } : { color: "#6B7280", borderColor: "#E5E7EB" }}>
              🔵 Facebook Messenger
            </button>
          </div>
          {channel === "messenger" && (
            <p className="text-[12px] text-gray-500 mt-1.5">Sends into each lead&apos;s Messenger thread (Meta-lead threads only), with automatic <b>SMS/email fallback</b> when there&apos;s no Messenger thread or the reply window has closed. Requires the Messenger connection to be live.</p>
          )}
        </div>

        {hasEmailStep && (
          <label className="block text-sm font-medium text-navy-900">
            Emails come from
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="DooGoodScoopers"
              className="block mt-1.5 w-full sm:w-80 px-3 py-2 text-sm font-normal border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="block text-xs font-normal text-gray-500 mt-1">The sender name people see, e.g. &quot;{WINBACK_FROM}&quot;. Every email includes an unsubscribe link automatically.</span>
          </label>
        )}
      </div>

      {/* Sequence */}
      <div className="dgs-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">2. Message sequence</h2>
        {steps.map((step, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-navy-900">
                {step.delayValue === 0 ? <Zap className="w-4 h-4 text-teal-600" /> : <Clock className="w-4 h-4 text-gray-400" />}
                Message {i + 1}
                {i === 0 && step.delayValue === 0 ? (
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
                    after enrollment <span className="text-teal-600">(immediately)</span>
                  </span>
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
                    {i === 0 ? "after enrollment" : "after the previous"}
                  </span>
                )}
              </span>
              {steps.length > 1 && (
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up" className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} title="Move down" className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => removeStep(i)} title="Remove" className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                <button type="button" onClick={() => updateStep(i, { channel: "sms" })}
                  className={`flex items-center gap-1 px-2.5 py-1 ${step.channel !== "email" ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  <MessageSquare className="w-3.5 h-3.5" /> Text
                </button>
                <button type="button" onClick={() => updateStep(i, { channel: "email" })}
                  className={`flex items-center gap-1 px-2.5 py-1 ${step.channel === "email" ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
              {step.channel === "email" ? (
                <button type="button" onClick={() => setPreview(preview === i ? null : i)} className="flex items-center gap-1 text-xs text-violet-700 hover:underline">
                  <Eye className="w-3.5 h-3.5" /> {preview === i ? "Hide preview" : "Preview"}
                </button>
              ) : (
                <span className="text-xs text-gray-400">{step.body.length} characters{step.body.length > 160 ? ` · sends as ${Math.ceil(step.body.length / 153)} text segments` : ""}</span>
              )}
            </div>
            {step.channel === "email" && (
              <input
                value={step.subject ?? ""}
                onChange={(e) => updateStep(i, { subject: e.target.value })}
                placeholder="Subject line"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            )}
            <textarea
              value={step.body}
              onChange={(e) => updateStep(i, { body: e.target.value })}
              rows={step.channel === "email" ? 10 : 3}
              placeholder={step.channel === "email" ? "Email text…  Leave a blank line between paragraphs." : "Message…  Use {{firstName}}, {{zipCode}}, {{dogs}} or {{reviewLink}} to personalize."}
              className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${step.channel === "email" ? "resize-y" : "resize-none"}`}
            />
            {step.channel === "email" && (
              <p className="text-xs text-gray-500">
                Use <code className="bg-gray-100 px-1 rounded">{"{{firstName}}"}</code> to personalize, <code className="bg-gray-100 px-1 rounded">**bold**</code> for bold, and put{" "}
                <code className="bg-gray-100 px-1 rounded">[Button text](https://link)</code> on its own line for a button.
              </p>
            )}
            {step.channel === "email" && preview === i && (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <p className="px-4 py-2 text-sm border-b border-gray-100 bg-gray-50 text-gray-700"><b>Subject:</b> {(step.subject || "").replace(/\{\{firstName\}\}/g, "Jamie")}</p>
                <div dangerouslySetInnerHTML={{ __html: emailTextToHtml(step.body.replace(/\{\{firstName\}\}/g, "Jamie")) }} />
              </div>
            )}
            {templates.length > 0 && step.channel !== "email" && (
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(false)}
          disabled={saving !== null}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
        >
          {saving === "launch" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {saving === "launch" ? "Saving…" : mode === "edit" ? "Save changes" : "Create & activate"}
        </button>
        {mode === "create" && (
          <button
            onClick={() => save(true)}
            disabled={saving !== null}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
          >
            {saving === "draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving === "draft" ? "Saving…" : "Save as draft"}
          </button>
        )}
      </div>
      {mode === "create" && <p className="text-xs text-gray-400 -mt-3">A draft won&apos;t enroll or message anyone until you activate it.</p>}
    </div>
  );
}
