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
  permissions: { granted: string[]; declined: string[] } | null;
  pageScope: string[] | null;
  webhook: {
    app: { callbackUrl: string | null; fields: string[]; active: boolean | null; error?: string };
    page: { apps: { id: string; name?: string; fields: string[] }[]; error?: string } | null;
  };
  recentHits: { at: string; sig: string; object: string; events: number; len: number; outcome: string }[];
}
const APP_ID = "3321005114736574";
const OUR_WEBHOOK = "https://doogoodscoopers.vercel.app/api/webhooks/messenger";
const NEEDED = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement"];

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
  async function relist() {
    setBusy("relist"); setResult(null);
    try {
      const r = await fetch("/api/admin/facebook/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "relist" }) });
      const d = await r.json();
      if (!r.ok) { setResult({ kind: "err", text: d.error || "Could not list Pages" }); return; }
      const detail = Array.isArray(d.errors) && d.errors.length ? ` Facebook said: ${d.errors.join(" · ")}` : "";
      setResult(d.count ? { kind: "ok", text: `Facebook now lists ${d.count} Page${d.count === 1 ? "" : "s"} for this profile — choose one below.` } : { kind: "warn", text: `Facebook still returns no Pages for this profile.${detail}` });
      await load(); router.replace("/admin/messenger");
    } finally { setBusy(null); }
  }
  async function saveConfigId() {
    setBusy("config");
    try { await fetch("/api/admin/facebook/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginConfigId: configId }) }); await load(); } finally { setBusy(null); }
  }

  const notice = NOTICE[flag];
  const tone = (k: "ok" | "warn" | "err") => k === "ok" ? "text-green-700 bg-green-50 border-green-200" : k === "warn" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="dgs-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center flex-shrink-0"><Facebook className="w-5 h-5 text-[#1877F2]" /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-navy-900">Facebook Page connection</h2>
            <p className="text-sm text-gray-500">Log in with Facebook, grant Page access, and pick the Page this app replies from on Messenger.</p>
          </div>
        </div>
        {s?.connected && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><Check className="w-3.5 h-3.5" /> Connected</span>}
      </div>

      {notice && <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 mb-4 ${tone(notice[1])}`}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{notice[0]}{msg ? ` (${msg})` : ""}</span></div>}
      {result && <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 mb-4 ${tone(result.kind)}`}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="min-w-0 break-words">{result.text}</span></div>}

      {!s ? <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking connection…</p> : (
        <>
          {/* Connected Page */}
          {s.connected && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 mb-4">
              {s.pagePicture ? <img src={s.pagePicture} alt="" className="w-10 h-10 rounded-full flex-shrink-0" /> : <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex-shrink-0" />}
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold text-navy-900 break-words">{s.pageName}</p>
                <p className="text-xs text-gray-500 break-words">Page ID {s.pageId}{s.userName ? ` · connected by ${s.userName}` : ""}{s.connectedAt ? ` · ${new Date(s.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
                <p className="text-xs text-gray-500 break-words">{s.webhookFields ? `Webhooks: ${s.webhookFields.split(",").join(", ")}` : "Webhooks: not subscribed"}</p>
              </div>
              <button onClick={disconnect} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-50 flex-shrink-0"><Unplug className="w-3.5 h-3.5" /> Disconnect</button>
            </div>
          )}
          {!s.connected && s.usingEnvToken && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Currently sending with the server-side Page token. Connect below to switch to a Page you authorize here.</p>
          )}

          {/* What Facebook actually granted on the last login — explains an empty Page list. */}
          {s.permissions && (() => {
            const missing = NEEDED.filter((n) => !s.permissions!.granted.includes(n));
            const noPages = s.pendingPages.length === 0 && !s.connected;
            return (
              <div className="mb-4 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Permissions on the last Facebook login{s.userName ? ` (${s.userName})` : ""}</p>
                <ul className="flex flex-wrap gap-2">
                  {NEEDED.map((n) => { const ok = s.permissions!.granted.includes(n); return (
                    <li key={n} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{ok ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}{n}</li>
                  ); })}
                </ul>
                {missing.length > 0 ? (
                  <p className="text-xs text-amber-800 mt-2">
                    Facebook did not grant {missing.join(", ")}. {missing.includes("pages_show_list") || missing.includes("pages_read_engagement")
                      ? "When the login dialog never offered Page permissions, the app is a Business-type app that ignores the scope list — create a Facebook Login for Business configuration (Advanced, below), save its ID, and connect again. If the dialog did offer them and you declined, connect again and accept."
                      : "Connect again and accept every permission in the dialog."}
                  </p>
                ) : noPages ? (
                  s.pageScope && s.pageScope.length === 0 ? (
                    <p className="text-xs text-amber-800 mt-2">All three permissions were granted, but no Page was selected in the dialog. Connect again and, on the &quot;What Pages do you want to use?&quot; step, choose the DooGoodScoopers Page.</p>
                  ) : s.pageScope && s.pageScope.length > 0 ? (
                    <p className="text-xs text-amber-800 mt-2">The login covers Page ID {s.pageScope.join(", ")}, yet Facebook returned no Pages for this profile. Click <b>List Pages again</b>; if it is still empty, this profile has no role on that Page.</p>
                  ) : (
                    <p className="text-xs text-amber-800 mt-2">
                      All three permissions were granted for <b>every Page this profile has a role on</b>, and Facebook returned none. So the Facebook profile &quot;{s.userName}&quot; is not an admin of the DooGoodScoopers Page (the Page is likely owned by your Business portfolio). Fix: on facebook.com open the Page → Settings → <b>Page access</b> (or Business Settings → Accounts → Pages → Add people) and give this profile full control. Then click <b>List Pages again</b> below.
                    </p>
                  )
                ) : null}
              </div>
            );
          })()}

          {/* Page picker after login */}
          {s.pendingPages.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Choose the Page to connect</p>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {s.pendingPages.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3 bg-white">
                    {p.picture ? <img src={p.picture} alt="" className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-gray-100" />}
                    <div className="min-w-0 flex-1"><p className="font-medium text-navy-900 break-words">{p.name}</p><p className="text-xs text-gray-500 break-words">{p.category || "Page"} · ID {p.id}</p></div>
                    <button onClick={() => choose(p.id)} disabled={!!busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1877F2] text-white hover:bg-[#166fe5] disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0">
                      {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}{s.pageId === p.id ? "Reconnect" : "Use this Page"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Webhook diagnostics: both halves must be right for a message to reach the CRM. */}
          {s.webhook && (() => {
            const a = s.webhook.app; const pg = s.webhook.page;
            const urlOk = a.callbackUrl === OUR_WEBHOOK; const msgOk = a.fields.includes("messages");
            const ours = pg?.apps.find((x) => x.id === APP_ID);
            const Row = ({ ok, children }: { ok: boolean | null; children: React.ReactNode }) => (
              <li className="flex items-start gap-2 text-xs"><span className={`mt-0.5 inline-flex w-4 h-4 rounded-full items-center justify-center flex-shrink-0 ${ok ? "bg-green-100 text-green-700" : ok === null ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>{ok ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}</span><span className="min-w-0 break-words">{children}</span></li>
            );
            return (
              <div className="mb-4 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Webhook check (from Facebook)</p>
                <ul className="space-y-1">
                  {a.error ? <Row ok={false}>Could not read this app&apos;s webhook settings: {a.error}</Row> : (<>
                    <Row ok={!!a.callbackUrl && urlOk}>App webhook for Pages: {a.callbackUrl ? <>points at <code className="break-all">{a.callbackUrl}</code>{urlOk ? "" : " — must be " + OUR_WEBHOOK}</> : "not set up. In the Meta dashboard open Webhooks → Page, set the callback URL and verify it."}</Row>
                    <Row ok={a.active}>App webhook active: {a.active === null ? "unknown" : a.active ? "yes" : "no — Facebook disabled it (usually after failed deliveries). Re-verify it in Webhooks → Page."}</Row>
                    <Row ok={msgOk}>App subscribed to the &quot;messages&quot; field: {a.fields.length ? a.fields.join(", ") : "none"}{msgOk ? "" : " — in Webhooks → Page click Subscribe on messages, messaging_postbacks, messaging_optins, messaging_referrals."}</Row>
                  </>)}
                  {pg && (pg.error ? <Row ok={false}>Could not read the Page&apos;s subscribed apps: {pg.error}</Row> : (
                    <Row ok={!!ours && ours.fields.includes("messages")}>Page subscribed to this app: {ours ? `yes (${ours.fields.join(", ")})` : pg.apps.length ? `no — subscribed to ${pg.apps.map((x) => x.name || x.id).join(", ")} instead` : "no apps subscribed"}</Row>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Did Facebook actually call us? */}
          <div className="mb-4 p-3 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Recent webhook deliveries to this server</p>
            {s.recentHits.length === 0 ? <p className="text-xs text-gray-500">None recorded yet. Message the Page, then click Refresh.</p> : (
              <ul className="space-y-1">
                {s.recentHits.map((h, i) => (
                  <li key={i} className="text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="text-gray-500 whitespace-nowrap">{new Date(h.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                    <span className={h.sig === "ok" ? "text-green-700" : "text-red-700"}>signature {h.sig}</span>
                    <span className="text-gray-600">{h.events} event{h.events === 1 ? "" : "s"}</span>
                    <span className="text-navy-900 break-words">{h.outcome}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/admin/facebook/connect" className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white ${s.configured ? "bg-[#1877F2] hover:bg-[#166fe5]" : "bg-gray-300 pointer-events-none"}`}>
              <Facebook className="w-4 h-4" /> {s.connected ? "Reconnect with Facebook" : "Connect with Facebook"}
            </a>
            {s.permissions && !s.connected && (
              <button onClick={relist} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {busy === "relist" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} List Pages again
              </button>
            )}
            <button onClick={() => load()} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
          {!s.configured && <p className="text-xs text-red-600 mt-2">FB_APP_SECRET is not set on the server, so the Facebook login cannot start.</p>}

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-gray-600">Advanced: Facebook Login for Business configuration</summary>
            <p className="text-xs text-gray-500 mt-2">If Facebook rejects the login with an &quot;invalid scopes&quot; error, the app is a Business-type app and needs a Login for Business configuration. In the Meta dashboard open Facebook Login for Business → Configurations, create one with pages_show_list, pages_messaging, pages_manage_metadata and pages_read_engagement, and paste its Configuration ID here.</p>
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
