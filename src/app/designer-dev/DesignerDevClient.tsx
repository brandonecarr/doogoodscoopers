"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EmailDesignerHandle } from "@/components/admin/designer/EmailDesigner";

const EmailDesigner = dynamic(() => import("@/components/admin/designer/EmailDesigner"), { ssr: false });

const STARTER = `<table width="100%"><tr><td style="padding:24px;font-family:Arial;"><h1 style="color:#0B1B2B;">Hi {{firstName}}</h1><p style="color:#3D5265;line-height:1.6;">A starter paragraph with a <a href="https://doogoodscoopers.com">link</a>.</p><p><a href="{{resumeLink}}" style="background:#008EFF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Finish my signup</a></p></td></tr></table>`;

export default function DesignerDevClient() {
  const ref = useRef<EmailDesignerHandle | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // ?sample=e1 loads public/dev-samples/e1.html (a handoff email) instead of the starter.
  const [initial, setInitial] = useState<string | null>(() => (typeof window !== "undefined" && !new URLSearchParams(window.location.search).get("sample") && !new URLSearchParams(window.location.search).get("design") ? STARTER : null));
  // ?design=name loads public/dev-samples/name.json as a v2 design instead.
  const [initialDesign, setInitialDesign] = useState<unknown>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sample = q.get("sample"), design = q.get("design");
    if (design) { fetch(`/dev-samples/${design}.json`).then((r) => r.json()).then((d) => { setInitialDesign(d); setInitial(""); }).catch(() => setInitial(STARTER)); return; }
    if (!sample) return;
    fetch(`/dev-samples/${sample}.html`).then((r) => (r.ok ? r.text() : STARTER)).then((t) => setInitial(t)).catch(() => setInitial(STARTER));
  }, []);
  if (initial === null) return <div className="p-6 text-sm text-gray-500">Loading sample…</div>;
  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 flex items-center gap-3 px-3 border-b border-gray-200 text-sm">
        <b>Designer dev harness</b>
        <span className="text-gray-500">{dirty ? "Unsaved changes" : "No changes"}</span>
        <button type="button" onClick={() => setHtml(ref.current?.getHtml() ?? "")} className="ml-auto px-3 py-1 rounded bg-navy-900 text-white">Export HTML</button>
      </div>
      <div className="flex-1 min-h-0">
        <EmailDesigner initialDesign={initialDesign ?? undefined} initialHtml={initial} onReady={(h) => (ref.current = h)} onChange={setDirty} />
      </div>
      {html !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 p-8" onClick={() => setHtml(null)}>
          <iframe title="export" srcDoc={html} className="w-full h-full bg-white rounded-xl" />
        </div>
      )}
    </div>
  );
}
