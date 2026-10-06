"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, RefreshCw, Ban, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";

// A quote lead's personal resume link (doogoodscoopers.com/r/?c=CODE) and where
// they are on the way from quote to signup.
export function QuoteRecoveryCard(props: {
  leadId: string; status: string; statusLabel: string; link: string | null; disabled: boolean;
  openedAt: string | null; lastOpenedAt: string | null; openCount: number; channel: string | null;
  expiresAt: string | null; hasEntry: boolean; marketingAllowed: boolean | null; resumable: boolean; quotedPrice: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: "create" | "regenerate" | "disable" | "enable") => {
    if (action === "regenerate" && !confirm("Generate a new link? The old one stops working immediately.")) return;
    setBusy(action); setError(null);
    try {
      const r = await fetch(`/api/admin/quote-leads/${props.leadId}/resume`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error || "Something went wrong");
      router.refresh();
    } finally { setBusy(null); }
  };
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);
  const badge: Record<string, string> = { quoted: "bg-blue-100 text-blue-800", abandoned: "bg-amber-100 text-amber-800", returned: "bg-violet-100 text-violet-800", signed_up: "bg-green-100 text-green-800", archived: "bg-gray-100 text-gray-600" };
  const btn = "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="dgs-card p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2"><Link2 className="w-4 h-4 text-teal-600" /> Quote recovery</h2>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge[props.status] || "bg-gray-100 text-gray-600"}`}>{props.statusLabel}</span>
      </div>
      {!props.resumable ? (
        <p className="text-sm text-gray-500">Resume links are only for quotes that came through the Sweep&amp;Go quote form.</p>
      ) : (
        <>
          {props.link ? (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Personal resume link{props.disabled ? " (disabled)" : ""}</p>
              <p className={`text-sm font-mono break-all ${props.disabled ? "text-gray-400 line-through" : "text-navy-900"}`}>{props.link}</p>
              <div className="flex flex-wrap gap-1.5">
                {!props.disabled && <CopyLinkButton link={props.link} />}
                {!props.disabled && <a href={props.link} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="w-3 h-3" /> Open</a>}
                <button type="button" disabled={!!busy} onClick={() => act("regenerate")} className={btn}>{busy === "regenerate" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate</button>
                {props.disabled
                  ? <button type="button" disabled={!!busy} onClick={() => act("enable")} className={btn}><CheckCircle2 className="w-3 h-3" /> Enable</button>
                  : <button type="button" disabled={!!busy} onClick={() => act("disable")} className={`${btn} text-red-600`}><Ban className="w-3 h-3" /> Disable</button>}
              </div>
            </div>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => act("create")} className={btn}>{busy === "create" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Create resume link</button>
          )}
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">Opened</dt>
            <dd className="text-navy-900">{props.openedAt ? `${fmt(props.openedAt)}${props.openCount > 1 ? ` · ${props.openCount} times, last ${fmt(props.lastOpenedAt)}` : ""}${props.channel ? ` · from ${props.channel === "sms" ? "a text" : props.channel === "email" ? "an email" : "elsewhere"}` : ""}` : "not yet"}</dd>
            <dt className="text-gray-500">Expires</dt>
            <dd className="text-navy-900">{props.expiresAt ? fmt(props.expiresAt) : "never"}</dd>
            {props.quotedPrice && (<><dt className="text-gray-500">Quoted</dt><dd className="text-navy-900">{props.quotedPrice}</dd></>)}
            <dt className="text-gray-500">Sweep&amp;Go quote</dt>
            <dd className="text-navy-900">{props.hasEntry ? "attached — signup continues this quote" : "not on file — signup starts a fresh entry"}</dd>
            <dt className="text-gray-500">Text consent box</dt>
            <dd className="text-navy-900">{props.marketingAllowed == null ? "unknown" : props.marketingAllowed ? "checked" : "not checked"}</dd>
          </dl>
          <p className="text-xs text-gray-400">The link opens the resume page on doogoodscoopers.com, then the schedule page with everything filled in. Use <code className="bg-gray-100 px-1 rounded">{"{{resumeLink}}"}</code> in texts and emails.</p>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
