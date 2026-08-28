"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Play, MapPin, Trophy, AlertTriangle } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Local rank grid. Each dot is one Google Places query run from that exact
 * lat/lng, coloured by where the business ranked there.
 */

interface City { id: string; name: string; lat: number; lng: number; gridSize: number; spacingKm: number }
interface Scan {
  id: string; cityName: string; keyword: string; businessName: string; createdAt: string;
  gridSize: number; spacingKm: number; pointCount: number; foundCount: number;
  top3Count: number; avgRank: number | null; status: string; error: string | null;
}
interface Point { lat: number; lng: number; rank: number | null; topNames: string | null }

const COST_PER_CALL = 0.032;
const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6D3EF0]/30 focus:border-transparent";

/** Local Falcon-style scale: green = in the 3-pack, red = nowhere. */
function rankColor(rank: number | null): string {
  if (rank === null) return "#7F1D1D";
  if (rank <= 3) return "#16A34A";
  if (rank <= 7) return "#84CC16";
  if (rank <= 10) return "#EAB308";
  if (rank <= 15) return "#F97316";
  return "#DC2626";
}

export function RankGrid({ token, defaultBusiness }: { token?: string; defaultBusiness: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [keyword, setKeyword] = useState("pooper scooper service");
  const [business, setBusiness] = useState(defaultBusiness);

  const [newCity, setNewCity] = useState("");
  const [gridSize, setGridSize] = useState(7);
  const [spacingKm, setSpacingKm] = useState(2);

  const [scan, setScan] = useState<Scan | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const city = cities.find((c) => c.id === cityId) || null;
  const pointCount = city ? city.gridSize * city.gridSize : 0;
  const estCost = pointCount * COST_PER_CALL;

  const loadCities = useCallback(() => {
    fetch("/api/admin/rank-grid/cities")
      .then((r) => r.json())
      .then((d) => {
        const list: City[] = d.cities ?? [];
        setCities(list);
        setCityId((cur) => cur || list[0]?.id || "");
      })
      .catch(() => {});
  }, []);
  useEffect(loadCities, [loadCities]);

  // ---- map ---------------------------------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-117.42, 34.07],
        zoom: 10,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "grid-dot", type: "circle", source: "grid",
          paint: {
            "circle-radius": 15,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "grid-label", type: "symbol", source: "grid",
          layout: { "text-field": ["get", "label"], "text-size": 12, "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"] },
          paint: { "text-color": "#ffffff" },
        });
        setReady(true);
      });
      mapRef.current = map;
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Draw whatever scan is loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource("grid")?.setData({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        properties: {
          color: rankColor(p.rank),
          label: p.rank === null ? "20+" : String(p.rank),
        },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    });
    if (points.length) {
      const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, duration: 600 }
      );
    }
  }, [points, ready]);

  // Load the latest scan whenever the city changes.
  useEffect(() => {
    if (!cityId) { setScan(null); setPoints([]); return; }
    fetch(`/api/admin/rank-grid/scan?cityId=${encodeURIComponent(cityId)}`)
      .then((r) => r.json())
      .then((d) => { setScan(d.scan ?? null); setPoints(d.points ?? []); })
      .catch(() => {});
  }, [cityId]);

  const addCity = async () => {
    setError("");
    if (!newCity.trim()) return setError("Enter a city or ZIP.");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/rank-grid/cities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCity, gridSize, spacingKm }),
      });
      const d = await res.json();
      if (!res.ok) return setError(d.error || "Could not add that city.");
      setNewCity("");
      setCities((c) => [...c, d.city].sort((a, b) => a.name.localeCompare(b.name)));
      setCityId(d.city.id);
    } finally { setAdding(false); }
  };

  const removeCity = async (id: string) => {
    await fetch(`/api/admin/rank-grid/cities?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setCities((c) => c.filter((x) => x.id !== id));
    if (cityId === id) { setCityId(""); setScan(null); setPoints([]); }
  };

  const run = async () => {
    setError("");
    if (!cityId) return setError("Add and select a city first.");
    if (!keyword.trim() || !business.trim()) return setError("Keyword and business name are both required.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/rank-grid/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, keyword, businessName: business }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Scan failed."); return; }
      setScan(d.scan); setPoints(d.points ?? []);
    } catch {
      setError("Scan failed.");
    } finally { setBusy(false); }
  };

  const coverage = scan && scan.pointCount ? (scan.top3Count / scan.pointCount) * 100 : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
      {/* Controls */}
      <div className="space-y-3.5">
        <div className="dgs-card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-navy-900">Run a scan</h2>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">City</label>
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputCls}>
              {cities.length === 0 && <option value="">Add a city below…</option>}
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.gridSize}×{c.gridSize} @ {c.spacingKm}km</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Keyword</label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="pooper scooper service" className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Your business name (as Google shows it)</label>
            <input value={business} onChange={(e) => setBusiness(e.target.value)} className={inputCls} />
          </div>

          {city && (
            <p className="text-[11.5px] text-gray-500">
              {pointCount} points · about <b>${estCost.toFixed(2)}</b> in Google Places calls
              <span className="block text-gray-400">First 5,000 calls each month are free.</span>
            </p>
          )}

          {error && (
            <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </p>
          )}

          <button onClick={run} disabled={busy || !cityId}
            className="w-full px-3 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            style={{ background: "#6D3EF0" }}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning {pointCount} points…</> : <><Play className="w-4 h-4" /> Run scan</>}
          </button>
        </div>

        {/* Cities */}
        <div className="dgs-card p-5">
          <h2 className="text-lg font-semibold text-navy-900 mb-3">Cities</h2>
          <div className="space-y-2">
            <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Fontana, CA  or  92336" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className={inputCls}>
                {[5, 7, 9, 11, 13].map((n) => <option key={n} value={n}>{n} × {n} ({n * n} pts)</option>)}
              </select>
              <select value={spacingKm} onChange={(e) => setSpacingKm(Number(e.target.value))} className={inputCls}>
                {[0.5, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} km apart</option>)}
              </select>
            </div>
            <button onClick={addCity} disabled={adding}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add city
            </button>
          </div>

          {cities.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100">
              {cities.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-[13px]">
                  <button onClick={() => setCityId(c.id)} className="text-left min-w-0 flex-1">
                    <span className={cityId === c.id ? "font-semibold text-navy-900" : "text-gray-700"}>{c.name}</span>
                    <span className="block text-[11px] text-gray-400">{c.gridSize}×{c.gridSize} · {c.spacingKm}km</span>
                  </button>
                  <button onClick={() => removeCity(c.id)} className="text-gray-400 hover:text-red-600 flex-shrink-0" aria-label={`Remove ${c.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Map + results */}
      <div className="lg:col-span-2 space-y-3.5">
        {scan && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={Trophy} label="In the 3-pack" value={`${scan.top3Count}/${scan.pointCount}`} sub={coverage !== null ? `${coverage.toFixed(0)}% of the area` : ""} tint="#16A34A" />
            <Stat icon={MapPin} label="Appear at all" value={`${scan.foundCount}/${scan.pointCount}`} sub="in top 20" tint="#0EA5E9" />
            <Stat icon={Trophy} label="Average rank" value={scan.avgRank ? scan.avgRank.toFixed(1) : "—"} sub="where found" tint="#6D3EF0" />
            <Stat icon={MapPin} label="Blind spots" value={`${scan.pointCount - scan.foundCount}`} sub="not ranking" tint="#DC2626" />
          </div>
        )}

        <div className="dgs-card p-2">
          {!token ? (
            <p className="p-4 text-[13px] text-gray-600">Map unavailable — <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> isn&apos;t set.</p>
          ) : (
            <div ref={containerRef} className="w-full h-[520px] rounded-xl overflow-hidden" />
          )}
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-[11.5px] text-gray-600">
            {[["1–3 (3-pack)", "#16A34A"], ["4–7", "#84CC16"], ["8–10", "#EAB308"], ["11–15", "#F97316"], ["16–20", "#DC2626"], ["Not ranking", "#7F1D1D"]].map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        </div>

        {scan && (
          <p className="text-[12px] text-gray-500">
            <b>{scan.keyword}</b> · {scan.cityName} · {new Date(scan.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {scan.status === "partial" && <span className="text-amber-700"> · some points failed ({scan.error})</span>}
          </p>
        )}
        {!scan && cities.length > 0 && (
          <p className="text-[13px] text-gray-500">No scan yet for this city — run one to see where you rank.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tint }: { icon: React.ElementType; label: string; value: string; sub: string; tint: string }) {
  return (
    <div className="dgs-card p-3 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: `${tint}1A` }}>
        <Icon className="w-4 h-4" style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-[18px] font-extrabold text-navy-900 leading-tight">{value}</p>
        <p className="text-[10.5px] text-gray-500 truncate">{sub}</p>
      </div>
    </div>
  );
}
