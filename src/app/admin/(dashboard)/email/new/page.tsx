"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Send, Users, Eye, Paintbrush, LayoutTemplate, X } from "lucide-react";
import type { EmailBuilderHandle } from "@/components/admin/EmailBuilder";

const EmailBuilder = dynamic(() => import("@/components/admin/EmailBuilder"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-400">Loading designer…</div>,
});

const AUDIENCES = [
  { value: "customers", label: "Customers" },
  { value: "quote", label: "Quote leads" },
  { value: "ad", label: "Meta ad leads" },
  { value: "outofarea", label: "Out of area" },
  { value: "commercial", label: "Commercial" },
  { value: "career", label: "Careers" },
  { value: "subscribers", label: "Subscribers" },
];

const STARTER = `<div style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <h1 style="color:#0d9488;">Hi {{firstName}}! 🐾</h1>
  <p>Write your update here…</p>
  <p style="margin-top:24px;">— The DooGoodScoopers team</p>
</div>`;

export default function NewEmailPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("DooGoodScoopers");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [html, setHtml] = useState(STARTER);
  const [leadTypes, setLeadTypes] = useState<string[]>(["customers"]);
  const [withinDays, setWithinDays] = useState(0);
  const [testEmail, setTestEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [designJson, setDesignJson] = useState<object | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const builderRef = useRef<EmailBuilderHandle | null>(null);

  const toggle = (v: string) => setLeadTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  useEffect(() => {
    fetch("/api/admin/email-templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  async function loadTemplate(id: string) {
    if (!id) return;
    const res = await fetch(`/api/admin/email-templates/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setHtml(d.template.html || html);
    setDesignJson(d.template.designJson || null);
    if (!subject && d.template.subject) setSubject(d.template.subject);
  }

  function applyDesign() {
    if (builderRef.current) {
      setHtml(builderRef.current.getHtml());
      setDesignJson(builderRef.current.getDesign());
    }
    setShowBuilder(false);
  }

  const refreshCount = useCallback(async () => {
    setCount(null);
    try {
      const res = await fetch("/api/admin/email-campaigns/audience", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { leadTypes, withinDays: withinDays || undefined } }),
      });
      if (res.ok) setCount((await res.json()).count);
    } catch {}
  }, [leadTypes, withinDays]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  async function submit(action: "send" | "schedule" | "draft" | "test") {
    setMsg(null);
    if (!subject.trim() || !html.trim()) return setMsg("Subject and content are required.");
    if (action === "test" && !testEmail.trim()) return setMsg("Enter a test email address.");
    if (action === "schedule" && !scheduledAt) return setMsg("Pick a schedule time.");
    setBusy(action);
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, name, subject, fromName, fromEmail: fromEmail || undefined, replyTo: replyTo || undefined,
          html, designJson: designJson || undefined, testEmail, scheduledAt: scheduledAt || undefined,
          audienceFilter: { leadTypes, withinDays: withinDays || undefined },
        }),
      });
      const d = await res.json();
      if (!res.ok) return setMsg(d.error || "Something went wrong.");
      if (action === "test") return setMsg(d.success ? `Test sent to ${testEmail}.` : `Test failed: ${d.error || ""}`);
      router.push("/admin/email");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/email" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-navy-900">New Email</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. July newsletter" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's the email about?" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From name</label>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From email <span className="text-gray-400">(optional)</span></label>
                <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="uses verified default" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reply-to <span className="text-gray-400">(optional)</span></label>
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="hello@doogoodscoopers.com" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <select onChange={(e) => { loadTemplate(e.target.value); e.target.value = ""; }} defaultValue="" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      <option value="">Start from template…</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setShowBuilder(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700"><Paintbrush className="w-3.5 h-3.5" /> Design</button>
                  <button type="button" onClick={() => setShowPreview((s) => !s)} className="text-xs text-teal-600 hover:underline flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {showPreview ? "Hide" : "Show"} preview</button>
                </div>
              </div>
              <textarea value={html} onChange={(e) => { setHtml(e.target.value); setDesignJson(null); }} rows={10} className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 resize-y" />
              <p className="text-[11px] text-gray-400 mt-1">Use the <strong>Design</strong> button for the drag-and-drop builder, start from a saved template, or edit the HTML directly. {"{{firstName}}"} personalizes.</p>
            </div>
          </div>

          {/* Audience */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-navy-900">Audience</h2>
              <span className="ml-auto text-sm text-gray-500">{count === null ? "counting…" : `${count} recipients`}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button key={a.value} type="button" onClick={() => toggle(a.value)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${leadTypes.includes(a.value) ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{a.label}</button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Only those added within</label>
              <select value={withinDays} onChange={(e) => setWithinDays(parseInt(e.target.value))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                <option value={0}>All time</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preview + actions */}
        <div className="space-y-4">
          {showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <p className="text-xs text-gray-400 px-2 pb-2">Preview</p>
              <iframe title="preview" className="w-full h-[420px] rounded-lg border border-gray-100 bg-white" srcDoc={html.replace(/\{\{\s*firstName\s*\}\}/g, "Jordan")} />
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send a test</label>
              <div className="flex gap-2">
                <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
                <button onClick={() => submit("test")} disabled={busy !== null} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                  {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Test
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                <button onClick={() => submit("schedule")} disabled={busy !== null} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Schedule</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => submit("send")} disabled={busy !== null || !count} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm">
                  {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to {count ?? 0}
                </button>
                <button onClick={() => submit("draft")} disabled={busy !== null} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 disabled:opacity-50">Save draft</button>
              </div>
            </div>
            {msg && <p className="text-sm text-gray-700">{msg}</p>}
          </div>
        </div>
      </div>

      {/* Full-screen drag-and-drop designer */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
              <LayoutTemplate className="w-4 h-4 text-teal-600" /> Email designer
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowBuilder(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-1.5"><X className="w-4 h-4" /> Cancel</button>
              <button onClick={applyDesign} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">Use this design</button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <EmailBuilder initialHtml={html} initialDesign={designJson} onReady={(h) => (builderRef.current = h)} />
          </div>
        </div>
      )}
    </div>
  );
}
