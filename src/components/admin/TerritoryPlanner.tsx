"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Pencil, Check, X, Trash2, Loader2, Home, Users2, MapPinned, Undo2 } from "lucide-react";

export interface Territory {
  id: string;
  name: string;
  polygon: [number, number][];
  homeCount: number;
  areaAcres: number | null;
  color: string;
  assignedCanvasserId: string | null;
  assignedCanvasserName: string | null;
}
interface CanvasserOpt { id: string; name: string }

const IE_CENTER: [number, number] = [-117.42, 34.07];
const COLORS = ["#6D3EF0", "#2563EB", "#16A34A", "#EA580C", "#DB2777", "#0891B2"];

/** Rough area (acres) of a lng/lat ring — matches the server's estimate. */
function acresOf(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const latAvg = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mLat = 111_320, mLng = 111_320 * Math.cos(latAvg);
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * mLng * (y2 * mLat) - x2 * mLng * (y1 * mLat);
  }
  return Math.abs(a) / 2 / 4046.8564224;
}
const centroid = (ring: [number, number][]): [number, number] => {
  const n = ring.length || 1;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
};

export function TerritoryPlanner({ token, canvassers, initial }: { token: string | undefined; canvassers: CanvasserOpt[]; initial: Territory[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [territories, setTerritories] = useState<Territory[]>(initial);
  const [mode, setMode] = useState<"idle" | "drawing">("idle");
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  // Finished-but-unsaved area + its home count and the save form.
  const [pending, setPending] = useState<{ polygon: [number, number][]; areaAcres: number } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [form, setForm] = useState<{ name: string; color: string; assignedCanvasserId: string }>({ name: "", color: COLORS[0], assignedCanvasserId: "" });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    const res = await fetch("/api/admin/territories");
    if (res.ok) setTerritories(((await res.json()).territories ?? []) as Territory[]);
  }, []);

  // ── Map init (satellite so rooftops are visible) ────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: IE_CENTER,
        zoom: 12,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("saved", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "saved-fill", type: "fill", source: "saved", paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "pending"], 0.35, 0.22] } });
        map.addLayer({ id: "saved-line", type: "line", source: "saved", paint: { "line-color": ["get", "color"], "line-width": 2.5 } });
        map.addLayer({ id: "saved-label", type: "symbol", source: "saved", layout: { "text-field": ["get", "label"], "text-size": 13, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] }, paint: { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,.6)", "text-halo-width": 1.4 } });
        map.addSource("draftline", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "draft-line", type: "line", source: "draftline", filter: ["==", "$type", "LineString"], paint: { "line-color": "#F9FAFB", "line-width": 2, "line-dasharray": [2, 1] } });
        map.addLayer({ id: "draft-pts", type: "circle", source: "draftline", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#6D3EF0", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        setReady(true);
      });

      map.on("click", (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
        if (modeRef.current === "drawing") {
          setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hits = (map as any).queryRenderedFeatures(e.point, { layers: ["saved-fill"] }) as { properties?: { id?: string } }[];
        const id = hits.find((f) => f.properties?.id && f.properties.id !== "__pending__")?.properties?.id;
        setSelectedId(id ? String(id) : null);
      });
      map.on("mousemove", (e: { lngLat: { lng: number; lat: number } }) => {
        if (modeRef.current === "drawing") setCursor([e.lngLat.lng, e.lngLat.lat]);
      });
      map.on("dblclick", (e: { preventDefault?: () => void }) => {
        if (modeRef.current === "drawing") { e.preventDefault?.(); finishDraw(); }
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Sync the "saved" source (territories + the pending preview) ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("saved")) return;
    const feats = territories.map((t) => ({
      type: "Feature" as const,
      properties: { id: t.id, color: t.color, label: `${t.name} · ${t.homeCount} homes`, pending: false },
      geometry: { type: "Polygon" as const, coordinates: [[...t.polygon, t.polygon[0]]] },
    }));
    if (pending) {
      feats.push({
        type: "Feature",
        properties: { id: "__pending__", color: form.color, label: count != null ? `New · ${count} homes` : "New area", pending: true },
        geometry: { type: "Polygon", coordinates: [[...pending.polygon, pending.polygon[0]]] },
      });
    }
    map.getSource("saved").setData({ type: "FeatureCollection", features: feats });
  }, [territories, pending, count, form.color, ready]);

  // ── Sync the in-progress draft line + vertices ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("draftline")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features: any[] = draft.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} }));
    const line = cursor && draft.length ? [...draft, cursor] : draft;
    if (line.length >= 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} });
    map.getSource("draftline").setData({ type: "FeatureCollection", features });
  }, [draft, cursor, ready]);

  const startDrawing = () => {
    setPending(null); setCount(null); setSelectedId(null); setError("");
    setDraft([]); setCursor(null); setMode("drawing");
    mapRef.current?.doubleClickZoom?.disable?.();
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "crosshair";
  };
  const cancelDrawing = () => {
    setMode("idle"); setDraft([]); setCursor(null);
    mapRef.current?.doubleClickZoom?.enable?.();
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  };

  const finishDraw = () => {
    setDraft((d) => {
      if (d.length < 3) { setError("Add at least 3 points to close an area."); return d; }
      const polygon = d;
      setMode("idle"); setCursor(null);
      mapRef.current?.doubleClickZoom?.enable?.();
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
      setPending({ polygon, areaAcres: Math.round(acresOf(polygon) * 10) / 10 });
      setForm({ name: "", color: COLORS[territories.length % COLORS.length], assignedCanvasserId: "" });
      void countHomes(polygon);
      return [];
    });
  };

  const countHomes = async (polygon: [number, number][]) => {
    setCounting(true); setCount(null); setError("");
    try {
      const res = await fetch("/api/admin/territories/count", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polygon }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't count homes."); return; }
      setCount(data.count);
      setPending((p) => (p ? { ...p, areaAcres: data.areaAcres ?? p.areaAcres } : p));
    } catch { setError("Couldn't reach the map data service."); }
    finally { setCounting(false); }
  };

  const saveTerritory = async () => {
    if (!pending) return;
    if (!form.name.trim()) { setError("Give the area a name."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), polygon: pending.polygon, homeCount: count ?? 0, color: form.color, assignedCanvasserId: form.assignedCanvasserId || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Couldn't save."); return; }
      setPending(null); setCount(null);
      await refetch();
    } catch { setError("Something went wrong saving."); }
    finally { setSaving(false); }
  };

  const reassign = async (t: Territory, canvasserId: string) => {
    const res = await fetch("/api/admin/territories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, name: t.name, polygon: t.polygon, homeCount: t.homeCount, color: t.color, assignedCanvasserId: canvasserId || null }),
    });
    if (res.ok) await refetch();
  };
  const remove = async (t: Territory) => {
    if (!confirm(`Delete the "${t.name}" territory?`)) return;
    const res = await fetch("/api/admin/territories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id }) });
    if (res.ok) { setSelectedId(null); await refetch(); }
  };

  const selected = territories.find((t) => t.id === selectedId) || null;
  const totalHomes = territories.reduce((s, t) => s + t.homeCount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3.5">
      {/* Map */}
      <div className="dgs-card overflow-hidden relative" style={{ height: "calc(100vh - 230px)", minHeight: 480 }}>
        {!token && <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 text-[13px] text-gray-500 text-center p-6">Set <code className="mx-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in the environment to use the map.</div>}
        <div ref={containerRef} className="w-full h-full" />

        {/* Draw controls */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {mode === "idle" && !pending && (
            <button onClick={startDrawing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white shadow-lg" style={{ background: "#6D3EF0" }}>
              <Pencil className="w-4 h-4" /> Draw a territory
            </button>
          )}
          {mode === "drawing" && (
            <div className="bg-white rounded-lg shadow-lg p-2 flex flex-col gap-1.5 w-52">
              <p className="text-[11.5px] text-gray-500 px-1">Tap the map to trace the neighborhood. Double-tap or Finish to close.</p>
              <div className="flex gap-1.5">
                <button onClick={finishDraw} disabled={draft.length < 3} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "#16A34A" }}><Check className="w-3.5 h-3.5" /> Finish ({draft.length})</button>
                <button onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} className="px-2 py-1.5 rounded-md text-[12px] font-semibold text-gray-600 border border-gray-200 disabled:opacity-50"><Undo2 className="w-3.5 h-3.5" /></button>
                <button onClick={cancelDrawing} className="px-2 py-1.5 rounded-md text-[12px] font-semibold text-gray-600 border border-gray-200"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="space-y-3.5">
        {/* Save panel for a freshly drawn area */}
        {pending && (
          <div className="dgs-card p-4 space-y-3">
            <h3 className="text-[13px] font-bold text-navy-900 flex items-center gap-1.5"><MapPinned className="w-4 h-4 text-violet-500" /> New territory</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5 text-center">
                <div className="text-[22px] font-extrabold text-violet-700 leading-none">{counting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : count ?? "—"}</div>
                <div className="text-[10.5px] font-semibold text-violet-500 uppercase tracking-wide mt-1">Homes</div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
                <div className="text-[22px] font-extrabold text-gray-700 leading-none">{pending.areaAcres}</div>
                <div className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mt-1">Acres</div>
              </div>
            </div>
            <p className="text-[10.5px] text-gray-400 -mt-1">Home count is estimated from OpenStreetMap building footprints.</p>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Area name (e.g. Heritage Village – North)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Assign to canvasser</label>
              <select value={form.assignedCanvasserId} onChange={(e) => setForm({ ...form, assignedCanvasserId: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="">— Unassigned —</option>
                {canvassers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-6 h-6 rounded-full border-2" style={{ background: c, borderColor: form.color === c ? "#111827" : "transparent" }} />
              ))}
            </div>
            {error && <p className="text-[12px] text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={saveTerritory} disabled={saving || counting} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-60" style={{ background: "#6D3EF0" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save territory
              </button>
              <button onClick={() => { setPending(null); setCount(null); setError(""); }} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 border border-gray-200">Discard</button>
            </div>
          </div>
        )}

        {/* Selected territory */}
        {selected && !pending && (
          <div className="dgs-card p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13.5px] font-bold text-navy-900">{selected.name}</h3>
                <p className="text-[12px] text-gray-500">{selected.homeCount} homes · {selected.areaAcres ?? "—"} acres</p>
              </div>
              <span className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" style={{ background: selected.color }} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Assigned to</label>
              <select value={selected.assignedCanvasserId ?? ""} onChange={(e) => reassign(selected, e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="">— Unassigned —</option>
                {canvassers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={() => remove(selected)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /> Delete territory</button>
          </div>
        )}

        {/* Roster of territories */}
        <div className="dgs-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">Territories</h3>
            <span className="text-[11px] text-gray-400">{territories.length} · {totalHomes} homes</span>
          </div>
          {territories.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">None yet. Tap <b>Draw a territory</b> to outline your first neighborhood.</p>
          ) : (
            <div className="space-y-1">
              {territories.map((t) => (
                <button key={t.id} onClick={() => { setSelectedId(t.id); mapRef.current?.flyTo({ center: centroid(t.polygon), zoom: 15 }); }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left ${selectedId === t.id ? "bg-violet-50" : "hover:bg-gray-50"}`}>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-navy-900 truncate">{t.name}</span>
                    <span className="block text-[11.5px] text-gray-500 flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5"><Home className="w-3 h-3" /> {t.homeCount}</span>
                      <span className="inline-flex items-center gap-0.5 truncate"><Users2 className="w-3 h-3" /> {t.assignedCanvasserName || "Unassigned"}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
