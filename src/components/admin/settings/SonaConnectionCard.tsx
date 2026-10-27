"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneCall, Check, AlertCircle, Loader2, RefreshCw, Unplug } from "lucide-react";

interface Status {
  connected: boolean;
  connectedAt: string | null;
  connectedBy: string | null;
  tokensAt: string | null;
  scope: string | null;
  lastError: string | null;
  inboxes: Array<{ id: string; number: string; name: string; users: string }> | null;
  liveError: string | null;
}

function fmtPhone(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/**
 * Settings → "Sona calls": the one-time Quo sign-in that lets the CRM place Sona
 * (Quo's AI agent) calls from a lead's profile. Shows the live connection state
 * and the Quo numbers Sona can call from.
 */
export function SonaConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (live: boolean) => {
    setChecking(true);
    try {
      const r = await fetch(`/api/admin/quo-mcp/status${live ? "?live=1" : ""}`, { cache: "no-store" });
      setStatus(await r.json());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const quo = q.get("quo");
    if (quo === "connected") setFlash({ kind: "ok", text: "Quo connected. Sona can now place calls from the lead profile." });
    else if (quo === "error") setFlash({ kind: "error", text: q.get("msg") || "The Quo connection failed." });
    if (quo) window.history.replaceState({}, "", window.location.pathname + "#sona");
    // A live check right after connecting proves the tokens work; otherwise stay cheap.
    load(quo === "connected");
  }, [load]);

  const disconnect = async () => {
    if (!confirm("Disconnect Quo? Sona calls from the CRM will stop until you connect again.")) return;
    await fetch("/api/admin/quo-mcp/disconnect", { method: "POST" });
    setFlash({ kind: "ok", text: "Quo disconnected." });
    load(false);
  };

  const connected = !!status?.connected;
  return (
    <div className="dgs-card p-6" id="sona">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0"><PhoneCall className="w-5 h-5 text-teal-600" /></div>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Sona calls</h2>
            <p className="text-sm text-gray-500 max-w-xl">Lets the CRM have Sona, Quo&apos;s AI agent, place a call to a lead from their profile. Connect once with the Quo account that owns the (909) 366-3744 number. Each call uses 50 Quo automation credits; a call that ends within 15 seconds is free.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button type="button" onClick={() => load(true)} disabled={checking} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Test connection</button>
              <a href="/api/admin/quo-mcp/connect" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Reconnect</a>
              <button type="button" onClick={disconnect} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"><Unplug className="w-4 h-4" /> Disconnect</button>
            </>
          ) : (
            <a href="/api/admin/quo-mcp/connect" className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700"><PhoneCall className="w-4 h-4" /> Connect Quo</a>
          )}
        </div>
      </div>

      {flash && (
        <p className={`mt-4 text-sm rounded-lg px-3 py-2 ${flash.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{flash.text}</p>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        {status === null ? (
          <span className="text-gray-400 inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</span>
        ) : connected ? (
          <>
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>
            <span className="text-navy-900">Connected{status.connectedBy ? ` by ${status.connectedBy}` : ""}{status.connectedAt ? ` on ${new Date(status.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.</span>
            {status.tokensAt && <span className="text-gray-400">Token refreshed {new Date(status.tokensAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</span>}
          </>
        ) : (
          <>
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5" /></span>
            <span className="text-navy-900">Not connected.</span>
          </>
        )}
      </div>

      {status?.liveError && <p className="mt-2 text-sm text-red-700">Live check failed: {status.liveError}</p>}
      {status?.lastError && !status.liveError && <p className="mt-2 text-sm text-amber-700">Last error: {status.lastError}</p>}

      {status?.inboxes && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Numbers Sona can call from</p>
          <ul className="text-sm text-navy-900 space-y-0.5">
            {status.inboxes.length === 0 && <li className="text-gray-500">None. The connected Quo user isn&apos;t a member of any number.</li>}
            {status.inboxes.map((i) => <li key={i.id}>{fmtPhone(i.number)} <span className="text-gray-500">· {i.name}{i.users ? ` · ${i.users}` : ""}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
