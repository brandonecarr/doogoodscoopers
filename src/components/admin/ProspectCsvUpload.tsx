"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, X, FileDown } from "lucide-react";
import { heroBtnSecondary } from "@/components/admin/PageHero";

type Row = Record<string, string>;
type Skipped = { row: number; reason: string; name: string; sheet?: string };

/** Minimal CSV parser: handles quoted fields, embedded commas/newlines, CRLF. First row = headers. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim()));
  if (nonEmpty.length < 2) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

/**
 * Excel workbook → rows from EVERY sheet. Each sheet's first row is its own header
 * row, so sheets can be laid out differently (one per city, one per property type…).
 * Rows are tagged with the sheet name so the summary can say where a skip came from.
 */
async function parseWorkbook(buf: ArrayBuffer): Promise<{ rows: Row[]; sheets: string[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const rows: Row[] = []; const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]; if (!ws) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
    const clean = json.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("__EMPTY")).map(([k, v]) => [k.trim(), String(v ?? "").trim()])))
      .filter((r) => Object.values(r).some(Boolean)).map((r) => ({ ...r, __sheet: name }));
    if (clean.length) { rows.push(...clean); sheets.push(`${name} (${clean.length})`); }
  }
  return { rows, sheets };
}

export function ProspectCsvUpload() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: Skipped[]; sheets: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const isSheet = /\.(xlsx|xlsm|xls|ods)$/i.test(f.name);
      const parsed = isSheet ? await parseWorkbook(await f.arrayBuffer()) : { rows: parseCsv(await f.text()), sheets: [] as string[] };
      if (!parsed.rows.length) { setError(isSheet ? "No data rows found on any sheet. Each sheet's first row must be the column names." : "No data rows found. The first row must be the column names."); return; }
      const sheetOf = parsed.rows.map((r) => r.__sheet);
      const rows = parsed.rows.map(({ __sheet, ...rest }) => { void __sheet; return rest; });
      const r = await fetch("/api/admin/commercial-prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const d = await r.json(); if (!r.ok || !d.success) { setError(d.error || "Upload failed"); return; }
      const skipped: Skipped[] = (d.skipped as Skipped[]).map((s) => ({ ...s, sheet: sheetOf[s.row - 1] }));
      setResult({ created: d.created, skipped, sheets: parsed.sheets }); router.refresh();
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
                <p className="font-semibold">{result!.created} added to the call list</p>
                {result!.sheets.length > 0 && <p className="text-xs text-gray-500 mt-0.5">Sheets read: {result!.sheets.join(", ")}</p>}
                {result!.skipped.length > 0 && (<>
                  <p className="text-gray-500 mt-1">{result!.skipped.length} skipped:</p>
                  <ul className="mt-1 max-h-40 overflow-auto text-xs text-gray-600 space-y-0.5">{result!.skipped.map((s) => <li key={s.row}>{s.sheet ? `${s.sheet} · ` : ""}Row {s.row}{s.name ? ` · ${s.name}` : ""}: {s.reason}</li>)}</ul>
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
