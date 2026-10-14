"use client";

import { useEffect, useState } from "react";
import { Smartphone, Loader2, Check, Copy, RefreshCw, Send } from "lucide-react";

interface Health { ok: boolean; error?: string; serverVersion?: string; macOS?: string; privateApi?: boolean; helperConnected?: boolean; proxy?: string }
interface RelayData {
  settings: Record<string, string>;
  passwordSet: boolean;
  health: Health;
  cap: number;
  sentToday: number;
  webhookUrl: string | null;
}

const fmtPhone = (e164: string) => {
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
};
const ago = (iso?: string) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/**
 * Campaigns → Text sending: which line campaign texts leave from (Quo office line
 * or the iPhone relay), the relay's connection, pacing and a test send.
 */
export function TextSendingCard() {
  const [data, setData] = useState<RelayData | null>(null);
  const [provider, setProvider] = useState<"quo" | "iphone">("quo");
  const [url, setUrl] = useState("");
  const [number, setNumber] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [fallback, setFallback] = useState(true);
  const [cap, setCap] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/relay");
    if (!res.ok) return;
    const d = (await res.json()) as RelayData;
    setData(d);
    const s = d.settings;
    setProvider(s["campaigns.textProvider"] === "iphone" ? "iphone" : "quo");
    setUrl(s["relay.url"] || "");
    setNumber(s["relay.number"] || "");
    setEnabled(s["relay.enabled"] === "true");
    setFallback(s["relay.fallbackToQuo"] !== "false");
    setCap(s["relay.dailyCap"] || "");
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch("/api/admin/relay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { "campaigns.textProvider": provider, "relay.url": url, "relay.number": number, "relay.enabled": enabled ? "true" : "false", "relay.fallbackToQuo": fallback ? "true" : "false", "relay.dailyCap": cap } }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Couldn't save"); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      await load();
    } finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/admin/relay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", to: testTo }) });
      const j = await res.json();
      setTestResult(j.success ? `Sent as ${j.service || "text"} ✓` : `Failed: ${j.error || "unknown error"}`);
      await load();
    } finally { setTesting(false); }
  }

  const h = data?.health;
  const live = !!data && enabled && !!h?.ok;
  const statusDot = !data ? "bg-gray-300" : !enabled ? "bg-gray-400" : h?.ok ? "bg-green-500" : "bg-red-500";
  const statusText = !data ? "…" : !data.passwordSet ? "Password not set in Vercel" : !enabled ? "Switched off" : h?.ok ? `Connected${h.privateApi === false ? " · Private API off" : ""}` : h?.error || "Unreachable";

  return (
    <div className="dgs-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 mr-auto">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900 leading-none">Text sending</p>
            <p className="text-xs text-gray-500 mt-1">Which line campaign texts go out from. Each drip can override this.</p>
          </div>
        </div>

        {!data ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        ) : (
          <>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button type="button" onClick={() => setProvider("quo")} className={`px-3 py-1.5 ${provider === "quo" ? "bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>☎️ Office line</button>
              <button type="button" onClick={() => setProvider("iphone")} className={`px-3 py-1.5 ${provider === "iphone" ? "bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>📱 iPhone {number ? fmtPhone(number) : ""}</button>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600"><span className={`w-2 h-2 rounded-full ${statusDot}`} />{statusText}</span>
            {live && <span className="text-xs text-gray-500">{data.sentToday} of {data.cap} today</span>}
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-teal-700 hover:underline">{open ? "Hide relay setup" : "Relay setup"}</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? "Saved" : "Save"}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {provider === "iphone" && data && !live && (
        <p className="text-xs text-amber-700 mt-2">The iPhone is the default but the relay isn&apos;t live{fallback ? ", so texts go out from the office line until it is." : " and fallback is off, so campaign texts will fail."}</p>
      )}

      {open && data && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">BlueBubbles relay (Mac mini · DGS Relay user)</p>
            <label className="block text-sm">
              <span className="text-gray-700">Server URL</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://….trycloudflare.com" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <span className="text-[11px] text-gray-400">From the BlueBubbles server window. Updates itself when the tunnel changes.</span>
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">iPhone number</span>
              <input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </label>
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded border-gray-300 text-teal-600" /> Relay on</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} className="rounded border-gray-300 text-teal-600" /> Fall back to the office line if it fails</label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-700">Daily cap</span>
              <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder={`Warm-up ramp (today: ${data.cap})`} inputMode="numeric" className="mt-1 w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <span className="block text-[11px] text-gray-400">Blank = 40 a day the first week, 100 the second, then 200. Sends are spaced out; the rest wait for the next day.</span>
            </label>
            <p className="text-[11px] text-gray-400">Password: {data.passwordSet ? "set in Vercel ✓" : "add BLUEBUBBLES_PASSWORD in Vercel"}{data.settings["relay.rampStart"] ? ` · live since ${new Date(data.settings["relay.rampStart"]).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>Server: {h?.ok ? `v${h.serverVersion || "?"} on macOS ${h.macOS || "?"}${h.proxy ? ` via ${h.proxy}` : ""}` : h?.error || "—"}</li>
              <li>Private API: {h?.ok ? (h.privateApi ? (h.helperConnected === false ? "on, helper not connected" : "on ✓") : "off — new conversations will fail") : "—"}</li>
              <li>Last send: {ago(data.settings["relay.lastSendAt"])} · last webhook: {ago(data.settings["relay.lastWebhookAt"])}{data.settings["relay.lastEvent"] ? ` (${data.settings["relay.lastEvent"]})` : ""}</li>
            </ul>
            <div>
              <span className="text-sm text-gray-700">Webhook URL for the BlueBubbles server</span>
              <div className="mt-1 flex gap-2">
                <input readOnly value={data.webhookUrl || "Set BLUEBUBBLES_PASSWORD first"} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 font-mono" />
                <button type="button" disabled={!data.webhookUrl} onClick={() => { navigator.clipboard.writeText(data.webhookUrl || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </div>
              <span className="text-[11px] text-gray-400">Subscribe it to new messages, message updates, message errors and server URL changes.</span>
            </div>
            <div>
              <span className="text-sm text-gray-700">Send a test text</span>
              <div className="mt-1 flex gap-2">
                <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your cell number" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <button type="button" onClick={test} disabled={testing || !testTo} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40">{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send</button>
                <button type="button" onClick={load} title="Refresh status" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"><RefreshCw className="w-4 h-4" /></button>
              </div>
              {testResult && <p className={`text-xs mt-1 ${testResult.startsWith("Sent") ? "text-green-700" : "text-red-600"}`}>{testResult}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
