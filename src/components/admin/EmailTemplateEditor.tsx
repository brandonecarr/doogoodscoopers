"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { EmailBuilderHandle } from "@/components/admin/EmailBuilder";

const EmailBuilder = dynamic(() => import("@/components/admin/EmailBuilder"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-400">Loading designer…</div>,
});

const BRAND_STARTER = `<table style="width:100%;background:#0d1b2a;"><tr><td style="padding:20px;text-align:center;">
  <span style="color:#14b8a6;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;">DooGoodScoopers 🐾</span>
</td></tr></table>
<table style="width:100%;background:#ffffff;"><tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <h1 style="color:#0d9488;margin:0 0 12px;">Hi {{firstName}}!</h1>
  <p style="line-height:1.6;">Drag blocks from the right to build your email. Replace this text with your update.</p>
  <p style="margin:24px 0;"><a href="https://doogoodscoopers.com" style="background:#14b8a6;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Book now</a></p>
  <p style="color:#6b7280;">— The DooGoodScoopers team</p>
</td></tr></table>`;

export default function EmailTemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const isNew = !templateId;
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [initialHtml, setInitialHtml] = useState<string | null>(isNew ? BRAND_STARTER : null);
  const [initialDesign, setInitialDesign] = useState<object | null>(null);
  const [ready, setReady] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const handleRef = useRef<EmailBuilderHandle | null>(null);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/email-templates/${templateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.template) {
          setName(d.template.name || "");
          setSubject(d.template.subject || "");
          setInitialHtml(d.template.html || BRAND_STARTER);
          setInitialDesign(d.template.designJson || null);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [templateId, isNew]);

  async function save() {
    if (!handleRef.current) return;
    if (!name.trim()) return alert("Give your template a name.");
    setSaving(true);
    try {
      const html = handleRef.current.getHtml();
      const designJson = handleRef.current.getDesign();
      const res = await fetch(isNew ? "/api/admin/email-templates" : `/api/admin/email-templates/${templateId}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), html, designJson }),
      });
      if (res.ok) router.push("/admin/email/templates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/email/templates" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 w-48" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Default subject (optional)" className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" />
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save template
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 480 }}>
        {ready ? (
          <EmailBuilder initialHtml={initialHtml ?? undefined} initialDesign={initialDesign} onReady={(h) => (handleRef.current = h)} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>
        )}
      </div>
      <p className="text-xs text-gray-400">Use {"{{firstName}}"} anywhere to personalize. Blocks drag in from the top-right; click any element to edit its text and style.</p>
    </div>
  );
}
