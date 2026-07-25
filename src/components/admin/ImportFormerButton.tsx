"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";

// Pulls DISABLED Sweep&Go customers into the Former Customers archive.
export function ImportFormerButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function run() {
    if (!confirm("Import all disabled (past) customers from Sweep&Go into Former Customers?")) return;
    setBusy(true);
    setMsg(null);
    setError(false);
    try {
      const res = await fetch("/api/admin/customers/import-former", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Imported ${d.pulled} disabled customers (${d.created} new, ${d.updated} updated).`);
        router.refresh();
      } else {
        setError(true);
        setMsg(d.error || "Import failed.");
      }
    } catch {
      setError(true);
      setMsg("Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-50 text-sm font-medium"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Import disabled customers from Sweep&amp;Go
      </button>
      {msg && <p className={`text-xs ${error ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}
