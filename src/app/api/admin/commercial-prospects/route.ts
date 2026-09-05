import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importProspects, type ImportRow } from "@/lib/commercial-prospects";

/** Add prospects to the call list: `{ rows: [...] }` for a CSV import, or a single flat object. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Bad payload" }, { status: 400 }); }
  const raw = Array.isArray((body as { rows?: unknown[] })?.rows) ? (body as { rows: unknown[] }).rows : [body];
  // Each upload row may be wrapped as { row, hint } (hint = sheet name); a bare object is a row.
  const rows: ImportRow[] = raw.map((r) => (r && typeof r === "object" && "row" in (r as object) ? (r as ImportRow) : { row: r }));
  if (rows.length === 0) return NextResponse.json({ success: false, error: "No rows" }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ success: false, error: "Too many rows in one upload (max 2000)" }, { status: 400 });
  try {
    const r = await importProspects(rows);
    if (rows.length === 1 && r.created === 0 && r.merged === 0) return NextResponse.json({ success: false, error: r.skipped[0]?.reason || "Not added" }, { status: 400 });
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    console.error("[commercial-prospects import]", e);
    return NextResponse.json({ success: false, error: "Import failed" }, { status: 500 });
  }
}
