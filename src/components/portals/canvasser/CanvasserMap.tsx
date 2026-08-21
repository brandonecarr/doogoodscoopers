"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, X, UserPlus, Loader2, Download, Check as CheckIcon, Trash2, Move, Sparkles } from "lucide-react";
import { enqueue } from "@/lib/pwa/canvasser-outbox";
import { DoorListen } from "@/components/portals/canvasser/DoorListen";

// Offline base map: we render Mapbox as RASTER tiles (a style with no glyph or
// sprite dependencies) so every tile is a plain cacheable image. The service
// worker cache-firsts api.mapbox.com, and "Download this area" bulk-fetches the
// visible tiles into the same cache so the backdrop renders with no signal.
const TILE_CACHE = "dgs-canvasser-v1";
const rasterStyle = (token: string) => ({
  version: 8 as const,
  sources: {
    mb: {
      type: "raster" as const,
      tiles: [`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`],
      tileSize: 256,
      attribution: "© Mapbox © OpenStreetMap",
    },
  },
  layers: [{ id: "mb", type: "raster" as const, source: "mb" }],
});
const tileUrl = (token: string, z: number, x: number, y: number) =>
  `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/${z}/${x}/${y}@2x?access_token=${token}`;
function tileXY(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
  return { x: clamp(x), y: clamp(y) };
}
async function runLimited(urls: string[], limit: number, fn: (u: string) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, async () => {
    while (i < urls.length) await fn(urls[i++]);
  }));
}

// Interactive canvasser map: drop a pin on a home, set a disposition + notes, and
// optionally mark it a lead. All writes go through the offline outbox.

export interface VisitRow {
  clientKey: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  status: string;
  notes: string | null;
  aiNotes: string | null;
  canvasserLeadId: string | null;
  pending?: boolean;
}

const STATUS: { id: string; label: string; color: string }[] = [
  { id: "NOT_HOME", label: "Not home", color: "#9CA3AF" },
  { id: "CALLBACK", label: "Call back", color: "#F59E0B" },
  { id: "INTERESTED", label: "Interested", color: "#2563EB" },
  { id: "NOT_INTERESTED", label: "Not interested", color: "#EF4444" },
  { id: "LEAD", label: "Lead", color: "#16A34A" },
  { id: "DO_NOT_KNOCK", label: "Do not knock", color: "#111827" },
];
const colorFor = (s: string) => STATUS.find((x) => x.id === s)?.color ?? "#9CA3AF";
const IE_CENTER: [number, number] = [-117.4, 34.05];

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ck_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export function CanvasserMap({ token }: { token: string | undefined }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [territories, setTerritories] = useState<{ id: string; name: string; polygon: [number, number][]; homeCount: number; color: string }[]>([]);
  const [leadForm, setLeadForm] = useState<{ firstName: string; lastName: string; phone: string; email: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);

  const upsertLocal = useCallback((row: VisitRow) => {
    setVisits((prev) => {
      const i = prev.findIndex((v) => v.clientKey === row.clientKey);
      if (i === -1) return [row, ...prev];
      const next = [...prev];
      next[i] = { ...next[i], ...row };
      return next;
    });
  }, []);

  const saveVisit = useCallback((row: VisitRow) => {
    upsertLocal({ ...row, pending: true });
    void enqueue("visit", {
      clientKey: row.clientKey, lat: row.lat, lng: row.lng, status: row.status,
      notes: row.notes, address: row.address, city: row.city, zipCode: row.zipCode,
    });
  }, [upsertLocal]);

  // Latest visits, readable from marker drag callbacks without stale closures.
  const visitsRef = useRef<VisitRow[]>([]);
  useEffect(() => { visitsRef.current = visits; }, [visits]);

  // Move a pin (drag): update the position and re-grab the address for the new spot.
  const moveVisit = useCallback((clientKey: string, lat: number, lng: number) => {
    const v = visitsRef.current.find((x) => x.clientKey === clientKey);
    if (!v) return;
    upsertLocal({ ...v, lat, lng, address: null, city: null, zipCode: null, pending: true });
    void enqueue("visit", { clientKey, lat, lng, status: v.status, notes: v.notes, regeocode: true });
  }, [upsertLocal]);

  // Remove a pin. Enqueuing the delete under the same clientKey also cancels any
  // still-pending create, so an accidental pin that never synced just disappears.
  const removeVisit = useCallback((clientKey: string) => {
    setVisits((prev) => prev.filter((x) => x.clientKey !== clientKey));
    void enqueue("visit-delete", { clientKey });
  }, []);

  // Load existing pins.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/canvasser/visits")
      .then((r) => (r.ok ? r.json() : { visits: [] }))
      .then((d) => { if (!cancelled) setVisits((d.visits ?? []) as VisitRow[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // My assigned territories (drawn as an overlay).
  useEffect(() => {
    fetch("/api/canvasser/territories")
      .then((r) => r.json())
      .then((d) => setTerritories(d.territories ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource || !map.getSource("myterr")) return;
    map.getSource("myterr").setData({
      type: "FeatureCollection",
      features: territories
        .filter((t) => Array.isArray(t.polygon) && t.polygon.length >= 3)
        .map((t) => ({
          type: "Feature",
          properties: { color: t.color || "#6D3EF0", label: `${t.name} · ${t.homeCount} homes` },
          geometry: { type: "Polygon", coordinates: [[...t.polygon, t.polygon[0]]] },
        })),
    });
  }, [territories, ready]);

  // Reconcile server responses coming back from the outbox.
  useEffect(() => {
    const onSynced = (e: Event) => {
      const { kind, data } = (e as CustomEvent).detail as { kind: string; data: { visit?: VisitRow; lead?: { id: string } }; clientKey: string };
      if (kind === "visit" && data.visit) {
        upsertLocal({ ...data.visit, pending: false });
      }
    };
    window.addEventListener("canvasser-synced", onSynced);
    return () => window.removeEventListener("canvasser-synced", onSynced);
  }, [upsertLocal]);

  // Init map.
  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: rasterStyle(token),
        center: IE_CENTER,
        zoom: 12,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (cancelled) return;
        // Assigned-territory overlay (below the pins).
        map.addSource("myterr", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "myterr-fill", type: "fill", source: "myterr", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.14 } });
        map.addLayer({ id: "myterr-line", type: "line", source: "myterr", paint: { "line-color": ["get", "color"], "line-width": 2.5 } });
        map.addLayer({ id: "myterr-label", type: "symbol", source: "myterr", layout: { "text-field": ["get", "label"], "text-size": 12 }, paint: { "text-color": "#111827", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
        map.resize();
        setReady(true);
      });

      // Tap to drop a pin.
      map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        const clientKey = uuid();
        const row: VisitRow = {
          clientKey, lat: e.lngLat.lat, lng: e.lngLat.lng,
          address: null, city: null, zipCode: null, status: "NOT_HOME", notes: null, aiNotes: null, canvasserLeadId: null, pending: true,
        };
        saveVisit(row);
        setSelected(clientKey);
      });

      // Center on the rep.
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!cancelled) map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }); },
          () => {}, { enableHighAccuracy: true, timeout: 6000 },
        );
      }
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [token, saveVisit]);

  // Render markers whenever visits change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let mapboxgl: typeof import("mapbox-gl").default | null = null;
    (async () => {
      mapboxgl = (await import("mapbox-gl")).default;
      const seen = new Set<string>();
      for (const v of visits) {
        seen.add(v.clientKey);
        const existing = markersRef.current.get(v.clientKey);
        if (existing) {
          existing.setLngLat([v.lng, v.lat]);
          const dot = existing.getElement().firstChild as HTMLElement;
          if (dot) dot.style.background = colorFor(v.status);
        } else {
          const el = document.createElement("div");
          el.style.cssText = "cursor:pointer";
          el.innerHTML = `<div style="width:20px;height:20px;border-radius:50% 50% 50% 2px;transform:rotate(45deg);border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.35);background:${colorFor(v.status)}"></div>`;
          el.addEventListener("click", (ev) => { ev.stopPropagation(); setSelected(v.clientKey); });
          const marker = new mapboxgl!.Marker({ element: el, anchor: "bottom", draggable: true }).setLngLat([v.lng, v.lat]).addTo(map);
          marker.on("dragend", () => { const ll = marker.getLngLat(); moveVisit(v.clientKey, ll.lat, ll.lng); });
          markersRef.current.set(v.clientKey, marker);
        }
      }
      // Remove markers whose visit disappeared.
      for (const [key, marker] of markersRef.current) {
        if (!seen.has(key)) { marker.remove(); markersRef.current.delete(key); }
      }
    })();
  }, [visits, ready, moveVisit]);

  const locate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 }),
      () => {}, { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  // "Download this area for offline" — bulk-fetch the visible tiles (current zoom
  // plus two deeper levels) into the SW's cache so the base map renders offline.
  const [dl, setDl] = useState<{ active: boolean; done: number; total: number }>({ active: false, done: 0, total: 0 });
  const [toast, setToast] = useState("");
  const downloadArea = async () => {
    const map = mapRef.current;
    if (!map || !token || dl.active || typeof caches === "undefined") return;
    const b = map.getBounds();
    const z0 = Math.round(map.getZoom());
    const zooms = [z0, z0 + 1, z0 + 2].filter((z) => z >= 1 && z <= 19);
    const urls: string[] = [];
    for (const z of zooms) {
      const nw = tileXY(b.getWest(), b.getNorth(), z);
      const se = tileXY(b.getEast(), b.getSouth(), z);
      for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x++)
        for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y++)
          urls.push(tileUrl(token, z, x, y));
    }
    if (urls.length > 1500) {
      setToast("Zoom in a little — that area's too big to save at once.");
      setTimeout(() => setToast(""), 2600);
      return;
    }
    setDl({ active: true, done: 0, total: urls.length });
    try {
      const cache = await caches.open(TILE_CACHE);
      let done = 0;
      await runLimited(urls, 8, async (u) => {
        try {
          if (!(await cache.match(u))) {
            const res = await fetch(u);
            if (res.ok) await cache.put(u, res.clone());
          }
        } catch { /* skip a failed tile */ }
        done += 1;
        setDl((d) => ({ ...d, done }));
      });
      setToast(`Saved ${urls.length} tiles for offline ✓`);
    } catch {
      setToast("Couldn't save this area.");
    } finally {
      setDl({ active: false, done: 0, total: 0 });
      setTimeout(() => setToast(""), 2600);
    }
  };

  const cur = visits.find((v) => v.clientKey === selected) || null;

  const markLead = async () => {
    if (!cur || !leadForm) return;
    setSavingLead(true);
    const leadKey = uuid();
    await enqueue("lead", {
      clientKey: leadKey, visitClientKey: cur.clientKey,
      firstName: leadForm.firstName, lastName: leadForm.lastName, phone: leadForm.phone, email: leadForm.email,
      address: cur.address, city: cur.city, zipCode: cur.zipCode, notes: cur.notes, aiNotes: cur.aiNotes,
    });
    saveVisit({ ...cur, status: "LEAD", canvasserLeadId: "pending" });
    setSavingLead(false);
    setLeadForm(null);
    setSelected(null);
  };

  const removePin = () => {
    if (!cur) return;
    const warn = cur.canvasserLeadId
      ? "Remove this pin? It's marked as a lead — the lead stays in your list, but the map pin will be deleted."
      : "Remove this pin? This can't be undone.";
    if (typeof window !== "undefined" && !window.confirm(warn)) return;
    removeVisit(cur.clientKey);
    setSelected(null);
    setLeadForm(null);
  };

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 116px)", minHeight: 460 }}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden bg-gray-200" />

      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a] rounded-2xl">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}

      {/* Locate me + Save offline */}
      <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2">
        <button
          onClick={locate}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white shadow-lg text-[13px] font-bold text-gray-800 active:scale-95"
        >
          <Crosshair className="w-4 h-4 text-blue-600" /> Locate me
        </button>
        <button
          onClick={downloadArea}
          disabled={dl.active}
          title="Save this area's map so it works with no signal"
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white shadow-lg text-[13px] font-bold text-gray-800 active:scale-95 disabled:opacity-70"
        >
          {dl.active
            ? <><Loader2 className="w-4 h-4 animate-spin text-amber-600" /> {dl.total ? Math.round((dl.done / dl.total) * 100) : 0}%</>
            : <><Download className="w-4 h-4 text-amber-600" /> Save offline</>}
        </button>
      </div>

      <p className="absolute left-3 top-3 z-10 text-[11px] font-medium text-gray-700 bg-white/90 rounded-full px-2.5 py-1 shadow">
        Tap the map to drop a pin
      </p>

      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 bg-gray-900 text-white text-[12px] font-semibold rounded-full px-3 py-1.5 shadow-lg">
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> {toast}
        </div>
      )}

      {/* Detail sheet */}
      {cur && (
        <div className="absolute left-0 right-0 bottom-0 z-20 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,.18)] p-4 max-h-[70%] overflow-auto">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0 flex-1">
              {/* Editable address — re-mounts (via key) when a fresh geocode arrives */}
              <input
                key={`${cur.clientKey}|${cur.address ?? ""}`}
                defaultValue={cur.address ?? ""}
                onBlur={(e) => { const val = e.target.value.trim(); if (val !== (cur.address ?? "")) saveVisit({ ...cur, address: val || null }); }}
                placeholder={cur.pending ? "Locating address…" : "Add an address"}
                className="w-full text-[14px] font-bold text-gray-900 bg-transparent border-b border-transparent focus:border-violet-300 focus:outline-none py-0.5"
              />
              <p className="text-[12px] text-gray-500">{[cur.city, cur.zipCode].filter(Boolean).join(", ") || `${cur.lat.toFixed(5)}, ${cur.lng.toFixed(5)}`}</p>
            </div>
            <button onClick={() => { setSelected(null); setLeadForm(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <p className="text-[11px] text-gray-400 flex items-center gap-1 mb-2.5"><Move className="w-3 h-3" /> Drag the pin on the map to move it. Tap the address to edit it.</p>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => saveVisit({ ...cur, status: s.id })}
                className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors"
                style={cur.status === s.id ? { background: s.color, color: "#fff", borderColor: s.color } : { color: s.color, borderColor: "#E5E7EB" }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <textarea
            defaultValue={cur.notes ?? ""}
            onBlur={(e) => { if (e.target.value !== (cur.notes ?? "")) saveVisit({ ...cur, notes: e.target.value }); }}
            placeholder="Notes about this home…"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />

          {/* At-the-door AI note-taker */}
          <DoorListen
            key={cur.clientKey}
            clientKey={cur.clientKey}
            onNotes={(aiNotes) => upsertLocal({ ...cur, aiNotes })}
          />

          {/* AI notes captured for this home */}
          {cur.aiNotes && (
            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5" /> AI notes</p>
              <p className="text-[12.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">{cur.aiNotes}</p>
            </div>
          )}

          {/* Mark as lead */}
          {cur.canvasserLeadId ? (
            <p className="mt-3 text-[12.5px] font-semibold text-green-700 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Marked as a lead</p>
          ) : leadForm ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={leadForm.firstName} onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })} placeholder="First name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                <input value={leadForm.lastName} onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })} placeholder="Last name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="Phone" inputMode="tel" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="Email (optional)" inputMode="email" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <button onClick={markLead} disabled={savingLead} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "#16A34A" }}>
                {savingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Save lead
              </button>
            </div>
          ) : (
            <button
              onClick={() => setLeadForm({ firstName: "", lastName: "", phone: "", email: "" })}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "#6D3EF0" }}
            >
              <UserPlus className="w-4 h-4" /> Mark as lead
            </button>
          )}

          {/* Remove pin */}
          <button
            onClick={removePin}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove pin
          </button>
        </div>
      )}
    </div>
  );
}
