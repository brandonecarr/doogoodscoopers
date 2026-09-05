"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Facebook, Loader2, Check, AlertCircle, Unplug, RefreshCw } from "lucide-react";

interface Page { id: string; name: string; picture?: string; category?: string }
interface Status {
  configured: boolean; connected: boolean; usingEnvToken: boolean;
  pageId: string | null; pageName: string | null; pagePicture: string | null;
  userName: string | null; connectedAt: string | null; webhookFields: string | null;
  pendingPages: Page[]; loginConfigId: string;
}

const NOTICE: Record<string, [string, "ok" | "warn" | "err"]> = {
  choose: ["Logged in to Facebook. Now choose the Page this app should message from.", "ok"],
  nopages: ["Facebook login worked, but that account doesn't manage any Pages (or Page access wasn't granted). Try again and tick your Page.", "warn"],
  denied: ["Facebook login was cancelled.", "warn"],
  state: ["The login didn't complete (state mismatch). Start again.", "err"],
  error: ["Facebook returned an error during login.", "err"],
  notconfigured: ["FB_APP_SECRET isn't set on the server, so the login can't be started.", "err"],
};

/**
 * Connect Facebook Page: Facebook Login → grant pages_show_list / pages_messaging /
 * pages_manage_metadata → pick the Page → the app subscribes it to Messenger webhooks.
 */
export function FacebookConnectCard() {
  const router = useRouter();
  const params = useSearchParams();
  const flag = params.get("facebook") || "";
  const msg = params.get("msg") || "";
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [configId, setConfigId] = useState("");

  const load = () => fetch("/api/admin/facebook/status").then((r) => r.json()).then((d: Status) => { setS(d); setConfigId(d.loginConfigId || ""); }).catch(() => {});
  useEffect(() => { void load(); }, []);

  async function choose(pageId: string) {
    setBusy(pageId); setResult(null);
    try {
      const r = await fetch("/api/admin/facebook/select-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId }) });
      const d = await r.json();
      if (!r.ok) { setResult({ kind: "err", text: d.error || "Could not select that Page" }); return; }
      setResult(d.webhook?.ok
        ? { kind: "ok", text: `Connected to ${d.page.name}. Messenger webhooks subscribed (${d.webhook.fields.join(", ")}).` }
        : { kind: "warn", text: `Connected to ${d.page.name}, but subscribing webhooks failed: ${d.webhook?.error || "unknown"}` });
      await load(); router.replace("/admin/messenger");
    } finally { setBusy(null); }
  }
  async function disconnect() {
    if (!confirm("Disconnect the Facebook Page? Messenger replies and drips stop until you connect again.")) return;
    setBusy("disconnect");
    try { await fetch("/api/admin/facebook/disconnect", { method: "POST" }); setResult({ kind: "ok", text: "Disconnected." }); await load(); } finally { setBusy(null); }
  }
  async function saveConfigId() {
    setBusy("config");
    try { await fetch("/api/admin/facebook/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginConfigId: configId }) }); await load(); } finally { setBusy(null); }
  }

  const notice = NOTICE[flag];
  const tone = (k: "ok" | "warn" | "err") => k === "ok" ? "text-green-700 bg-green-50 border-green-200" : k === "warn" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="dgs-card p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center flex-shrink-0"><Facebook className="w-5 h-5 text-[#1877F2]" /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-navy-900">Facebook Page connection</h2>
            <p className="text-sm text-gray-500">Log in with Facebook, grant Page access, and pick the Page this app replies from on Messenger.</p>
          </div>
        </div>
        {s?.connected && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><Check className="w-3.5 h-3.5" /> Connected</span>}
      </div>

      {notice && <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 mb-4 ${tone(notice[1])}`}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{notice[0]}{msg ? ` (${msg})` : ""}</span></div>}
      {result && <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 mb-4 ${tone(result.kind)}`}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{result.text}</span></div>}

      {!s ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking connection…</p> : (
        <>
          {/* Connected Page */}
          {s.connected && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 mb-4">
              {s.pagePicture ? <img src={s.pagePicture} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#1877F2]/10" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-900 truncate">{s.pageName}</p>
                <p className="text-xs text-gray-500">Page ID {s.pageId}{s.userName ? ` · connected by ${s.userName}` : ""}{s.connectedAt ? ` · ${new Date(s.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
                <p className="text-xs text-gray-500">{s.webhookFields ? `Webhooks: ${s.webhookFields}` : "Webhooks: not subscribed"}</p>
              </div>
              <button onClick={disconnect} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-50"><Unplug className="w-3.5 h-3.5" /> Disconnect</button>
            </div>
          )}
          {!s.connected && s.usingEnvToken && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Currently sending with the server-side Page token. Connect below to switch to a Page you authorize here.</p>
          )}

          {/* Page picker after login */}
          {s.pendingPages.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Choose the Page to connect</p>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {s.pendingPages.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3 bg-white">
                    {p.picture ? <img src={p.picture} alt="" className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-gray-100" />}
                    <div className="min-w-0 flex-1"><p className="font-medium text-navy-900 truncate">{p.name}</p><p className="text-xs text-gray-500">{p.category || "Page"} · ID {p.id}</p></div>
                    <button onClick={() => choose(p.id)} disabled={!!busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1877F2] text-white hover:bg-[#166fe5] disabled:opacity-50 inline-flex items-center gap-1.5">
                      {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}{s.pageId === p.id ? "Reconnect" : "Use this Page"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/admin/facebook/connect" className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white ${s.configured ? "bg-[#1877F2] hover:bg-[#166fe5]" : "bg-gray-300 pointer-events-none"}`}>
              <Facebook className="w-4 h-4" /> {s.connected ? "Reconnect with Facebook" : "Connect with Facebook"}
            </a>
            <button onClick={() => load()} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
          {!s.configured && <p className="text-xs text-red-600 mt-2">FB_APP_SECRET is not set on the server, so the Facebook login cannot start.</p>}

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-gray-600">Advanced: Facebook Login for Business configuration</summary>
            <p className="text-xs text-gray-500 mt-2">If Facebook rejects the login with an &quot;invalid scopes&quot; error, the app is a Business-type app and needs a Login for Business configuration. In the Meta dashboard open Facebook Login for Business → Configurations, create one with pages_show_list, pages_messaging and pages_manage_metadata, and paste its Configuration ID here.</p>
            <div className="flex items-center gap-2 mt-2">
              <input value={configId} onChange={(e) => setConfigId(e.target.value)} placeholder="Configuration ID (numbers only)" className="w-64 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              <button onClick={saveConfigId} disabled={busy === "config"} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">Save</button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
