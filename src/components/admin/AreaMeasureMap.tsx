"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Undo2, Trash2, Check, MapPin, Loader2, Pencil } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Satellite area measurer for community quoting. Search a community, trace the
 * grass/common areas dogs actually use, and read off the total acreage — the
 * number the quote calculator asks you to "measure from satellite".
 *
 * Several separate lawns are the norm at an HOA, so shapes accumulate and the
 * total is their sum rather than a single box.
 */

const IE_CENTER: [number, number] = [-117.42, 34.07];
const SQFT_PER_ACRE = 43_560;

/** Area (acres) of a lng/lat ring, via the shoelace formula on a local
 *  equirectangular projection. Same math the territory planner uses. */
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

interface Shape { id: string; ring: [number, number][]; acres: number }
interface Hit { name: string; center: [number, number] }

export function AreaMeasureMap({
  token,
  onApply,
  onTotalChange,
  impact,
}: {
  token: string | undefined;
  onApply?: (acres: number, note: string) => void;
  /** Fires whenever the measured total changes, so the caller can price it live. */
  onTotalChange?: (acres: number) => void;
  /** Rendered under the tally — what this area does to the quote. */
  impact?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<"idle" | "drawing">("idle");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const draftRef = useRef<[number, number][]>(draft);
  draftRef.current = draft;

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<string>("");
  const [applied, setApplied] = useState(false);

  const total = shapes.reduce((s, x) => s + x.acres, 0);

  // ---- map init -----------------------------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: IE_CENTER,
        zoom: 11,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        map.addSource("shapes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "shapes-fill", type: "fill", source: "shapes", paint: { "fill-color": "#22C55E", "fill-opacity": 0.35 } });
        map.addLayer({ id: "shapes-line", type: "line", source: "shapes", paint: { "line-color": "#16A34A", "line-width": 2.5 } });

        map.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "draft-fill", type: "fill", source: "draft", paint: { "fill-color": "#FACC15", "fill-opacity": 0.25 } });
        map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#FACC15", "line-width": 2, "line-dasharray": [2, 1] } });
        map.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 4.5, "circle-color": "#fff", "circle-stroke-color": "#CA8A04", "circle-stroke-width": 2 } });
        setReady(true);
      });

      map.on("click", (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
        if (modeRef.current !== "drawing") return;
        const d = draftRef.current;
        // Clicking back on the first point closes the shape (as well as double-click).
        if (d.length >= 3) {
          const p0 = map.project(d[0]);
          if (Math.hypot(p0.x - e.point.x, p0.y - e.point.y) < 12) { finishShape(); return; }
        }
        setDraft((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      });
      map.on("mousemove", (e: { lngLat: { lng: number; lat: number } }) => {
        if (modeRef.current === "drawing") setCursor([e.lngLat.lng, e.lngLat.lat]);
      });
      map.on("dblclick", (e: { preventDefault?: () => void }) => {
        if (modeRef.current !== "drawing") return;
        e.preventDefault?.();
        finishShape();
      });

      mapRef.current = map;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- render shapes ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource("shapes")?.setData({
      type: "FeatureCollection",
      features: shapes.map((s) => ({
        type: "Feature",
        properties: { id: s.id },
        geometry: { type: "Polygon", coordinates: [[...s.ring, s.ring[0]]] },
      })),
    });
  }, [shapes, ready]);

  // ---- render the in-progress shape --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats: any[] = draft.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    const live = cursor && mode === "drawing" ? [...draft, cursor] : draft;
    if (live.length >= 2) feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: live } });
    if (live.length >= 3) feats.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...live, live[0]]] } });
    map.getSource("draft")?.setData({ type: "FeatureCollection", features: feats });
  }, [draft, cursor, mode, ready]);

  // ---- drawing ------------------------------------------------------------
  const startDraw = () => {
    setDraft([]); setCursor(null); setMode("drawing"); setApplied(false);
    mapRef.current?.doubleClickZoom?.disable();   // dbl-click closes a shape here
  };

  /** Close the current ring and immediately arm the next one — a community is
   *  several separate lawns, so drawing stays on until you say you're done. */
  const finishShape = useCallback(() => {
    const ring = draftRef.current;
    if (ring.length >= 3) {
      setShapes((s) => [...s, { id: `s${Date.now()}_${s.length}`, ring, acres: acresOf(ring) }]);
      setApplied(false);
    }
    setDraft([]);
    setCursor(null);
    setMode("drawing"); // keep going
  }, []);

  const undoPoint = () => setDraft((d) => d.slice(0, -1));
  const stopDrawing = () => {
    setDraft([]); setCursor(null); setMode("idle");
    mapRef.current?.doubleClickZoom?.enable();
  };

  // Enter closes the current shape, Escape stops drawing.
  useEffect(() => {
    if (mode !== "drawing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); finishShape(); }
      if (e.key === "Escape") { e.preventDefault(); stopDrawing(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, finishShape]);

  // Report the running total so the caller can price it live.
  useEffect(() => { onTotalChange?.(Math.round(total * 100) / 100); }, [total, onTotalChange]);

  // ---- search -------------------------------------------------------------
  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query || !token) return;
    setSearching(true);
    try {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${encodeURIComponent(token)}&country=us&limit=5&proximity=${IE_CENTER[0]},${IE_CENTER[1]}`;
      const res = await fetch(url);
      const j = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHits(((j.features as any[]) || []).map((f) => ({ name: f.place_name as string, center: f.center as [number, number] })));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const goTo = (h: Hit) => {
    setHits([]);
    setQ(h.name);
    setPlace(h.name);
    mapRef.current?.flyTo({ center: h.center, zoom: 17.5 });
  };

  if (!token) {
    return (
      <div className="dgs-card p-4 text-[13px] text-gray-600">
        Map unavailable — <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> isn&apos;t set for this deployment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={search} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a community, address, or ZIP…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6D3EF0]/30 focus:border-transparent"
            />
          </div>
          <button type="submit" disabled={searching}
            className="px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ background: "#6D3EF0" }}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Find
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {hits.map((h) => (
              <li key={h.name}>
                <button type="button" onClick={() => goTo(h)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50">
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {/* Map */}
      <div className="relative">
        <div ref={containerRef} className="w-full h-[460px] rounded-xl overflow-hidden border border-gray-200" />
        {mode === "drawing" && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow text-[12px] text-navy-900 max-w-[300px]">
            Click each corner of a grass area, then <b>double-click</b> (or press <b>Enter</b>) to close it.
            {shapes.length > 0 && <span className="block mt-0.5 text-green-700 font-semibold">{shapes.length} area{shapes.length === 1 ? "" : "s"} saved — keep drawing to add more.</span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {mode === "idle" ? (
          <button type="button" onClick={startDraw}
            className="px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
            style={{ background: "#16A34A" }}>
            <Pencil className="w-4 h-4" /> {shapes.length ? "Add another area" : "Draw an area"}
          </button>
        ) : (
          <>
            <button type="button" onClick={finishShape} disabled={draft.length < 3}
              className="px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"
              style={{ background: "#16A34A" }}>
              <Check className="w-4 h-4" /> Finish this area
            </button>
            <button type="button" onClick={undoPoint} disabled={!draft.length}
              className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-700 disabled:opacity-40 inline-flex items-center gap-1.5">
              <Undo2 className="w-4 h-4" /> Undo point
            </button>
            <button type="button" onClick={stopDrawing}
              className="px-3 py-2 rounded-lg border text-[13px] font-semibold"
              style={{ borderColor: "#6D3EF0", color: "#6D3EF0" }}>
              Done measuring
            </button>
          </>
        )}
        {shapes.length > 0 && (
          <button type="button" onClick={() => { setShapes([]); setApplied(false); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-semibold text-red-700 inline-flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Clear all
          </button>
        )}
      </div>

      {/* Tally */}
      <div className="dgs-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Measured area</p>
            <p className="text-[26px] font-extrabold text-navy-900 leading-tight tracking-[-0.02em]">
              {total.toFixed(2)} <span className="text-[15px] font-bold text-gray-500">acres</span>
            </p>
            <p className="text-[12px] text-gray-500">
              {Math.round(total * SQFT_PER_ACRE).toLocaleString()} sq ft
              {shapes.length > 0 && ` · ${shapes.length} area${shapes.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {onApply && (
            <button
              type="button"
              disabled={total <= 0}
              onClick={() => { onApply(Math.round(total * 100) / 100, place); setApplied(true); }}
              className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"
              style={{ background: "#6D3EF0" }}
            >
              <Check className="w-4 h-4" /> {applied ? "Applied to quote" : "Use this area in the quote"}
            </button>
          )}
        </div>

        {shapes.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {shapes.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between text-[13px]">
                <span className="text-gray-600">Area {i + 1}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-navy-900">{s.acres.toFixed(2)} ac</span>
                  <span className="text-gray-400 text-[12px]">{Math.round(s.acres * SQFT_PER_ACRE).toLocaleString()} sq ft</span>
                  <button type="button" onClick={() => setShapes((x) => x.filter((y) => y.id !== s.id))}
                    className="text-gray-400 hover:text-red-600" aria-label={`Remove area ${i + 1}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {impact && total > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">{impact}</div>
        )}

        {shapes.length === 0 && (
          <p className="mt-2 text-[12px] text-gray-500">
            Search the community, then trace each grass area dogs actually use. Draw as many separate areas as you need — they add up.
          </p>
        )}
      </div>
    </div>
  );
}
