"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, X, FileDown } from "lucide-react";
import { heroBtnSecondary } from "@/components/admin/PageHero";
import { gridToRows, parseCsvGrid, type Grid } from "@/lib/prospect-sheet";

type Skipped = { row: number; reason: string; name: string; sheet?: string };
type Item = { row: Record<string, string>; hint: string; sheet: string; rowNumber: number };

/** Excel workbook → rows from EVERY sheet; each sheet's header row is detected on its own. */
async function parseWorkbook(buf: ArrayBuffer): Promise<{ items: Item[]; sheets: string[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const items: Item[] = []; const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]; if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false }) as Grid;
    const rows = gridToRows(grid);
    if (rows.length) { rows.forEach((r) => items.push({ row: r.data, hint: name, sheet: name, rowNumber: r.rowNumber })); sheets.push(`${name} (${rows.length})`); }
  }
  return { items, sheets };
}

export function ProspectCsvUpload() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; merged: number; skipped: Skipped[]; sheets: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const isSheet = /\.(xlsx|xlsm|xls|ods)$/i.test(f.name);
      const parsed = isSheet ? await parseWorkbook(await f.arrayBuffer())
        : { items: gridToRows(parseCsvGrid(await f.text())).map((r) => ({ row: r.data, hint: "", sheet: "", rowNumber: r.rowNumber })), sheets: [] as string[] };
      if (!parsed.items.length) { setError("No data rows found. One row needs to hold the column names (Property, City, Phone…)" + (isSheet ? " on at least one sheet." : ".")); return; }
      const r = await fetch("/api/admin/commercial-prospects", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.items.map((it) => ({ row: it.row, hint: it.hint })) }) });
      const d = await r.json(); if (!r.ok || !d.success) { setError(d.error || "Upload failed"); return; }
      const skipped: Skipped[] = (d.skipped as Skipped[]).map((s) => { const it = parsed.items[s.row - 1]; return { ...s, row: it?.rowNumber ?? s.row, sheet: it?.sheet }; });
      setResult({ created: d.created, merged: d.merged ?? 0, skipped, sheets: parsed.sheets }); router.refresh();
    } catch { setError("Could not read that file"); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xlsm,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={onFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={heroBtnSecondary} title="CSV or Excel; every sheet in a workbook is read">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}<span className="hidden sm:inline">Upload CSV / Excel</span>
      </button>
      <a href="/api/admin/commercial-prospects/template" className={heroBtnSecondary} title="Column names are matched loosely; close variants work"><FileDown className="w-4 h-4" /><span className="hidden sm:inline">Template</span></a>
      {(result || error) && (
        <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:w-[440px] z-50 dgs-card p-4 shadow-xl border border-gray-200 text-ink">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm min-w-0">
              {error ? <p className="text-red-700">{error}</p> : (<>
                <p className="font-semibold">{result!.created} added to the call list{result!.merged > 0 ? `, ${result!.merged} merged into existing entries` : ""}</p>
                {result!.sheets.length > 0 && <p className="text-xs text-gray-500 mt-0.5">Sheets read: {result!.sheets.join(", ")}</p>}
                {result!.skipped.length > 0 && (<>
                  <p className="text-gray-500 mt-1">{result!.skipped.length} skipped:</p>
                  <ul className="mt-1 max-h-40 overflow-auto text-xs text-gray-600 space-y-0.5">{result!.skipped.map((s, i) => <li key={i}>{s.sheet ? `${s.sheet} · ` : ""}Row {s.row}{s.name ? ` · ${s.name}` : ""}: {s.reason}</li>)}</ul>
                </>)}
              </>)}
            </div>
            <button onClick={() => { setResult(null); setError(null); }} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
