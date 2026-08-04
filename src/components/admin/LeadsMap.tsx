"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LeadStatus } from "@/types/leads";

export interface MapLead {
  id: string;
  type: "quote" | "ad" | "instagram";
  name: string;
  status: LeadStatus;
  grade: string | null;
  createdAt: string;
}
export interface MapPoint {
  zip: string;
  lat: number;
  lng: number;
  place: string;
  count: number;
  statusCounts: Record<string, number>;
  leads: MapLead[];
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", NO_ANSWER: "No Answer",
  NOT_INTERESTED: "Lost", WAITING_FOR_SIGNUP: "Quoted", CONVERTED: "Won", PHONE_REVIEW: "Phone Review",
};

// Pin segment colors — matched to the status badges used across the leads UI.
const STATUS_COLOR: Record<LeadStatus, string> = {
  PHONE_REVIEW: "#eab308",       // yellow
  NEW: "#14b8a6",                // teal
  CONTACTED: "#3b82f6",          // blue
  NO_ANSWER: "#f97316",          // orange
  WAITING_FOR_SIGNUP: "#a855f7", // purple (Quoted)
  CONVERTED: "#22c55e",          // green (Won)
  NOT_INTERESTED: "#9ca3af",     // gray (Lost)
};
// Draw order for the donut segments (pipeline order).
const STATUS_ORDER: LeadStatus[] = ["PHONE_REVIEW", "NEW", "CONTACTED", "NO_ANSWER", "WAITING_FOR_SIGNUP", "CONVERTED", "NOT_INTERESTED"];

// Build a conic-gradient ring from a zip's status breakdown.
function ringGradient(counts: Record<string, number>, total: number): string {
  if (total <= 0) return "#0d9488";
  const segs: string[] = [];
  let acc = 0;
  for (const s of STATUS_ORDER) {
    const c = counts[s] || 0;
    if (!c) continue;
    const start = (acc / total) * 100;
    acc += c;
    const end = (acc / total) * 100;
    segs.push(`${STATUS_COLOR[s]} ${start}% ${end}%`);
  }
  return segs.length ? `conic-gradient(${segs.join(",")})` : "#0d9488";
}

const detailPath = (l: MapLead) =>
  `/admin/${l.type === "quote" ? "quote-leads" : l.type === "instagram" ? "instagram-leads" : "ad-leads"}/${l.id}`;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Marker diameter grows with lead count (gentle sqrt scale).
function markerSize(count: number, max: number) {
  const min = 30, cap = 62;
  if (max <= 1) return min;
  const t = Math.sqrt(count) / Math.sqrt(max);
  return Math.round(min + t * (cap - min));
}

function popupHTML(p: MapPoint): string {
  const rows = p.leads
    .map(
      (l) =>
        `<a href="${detailPath(l)}" style="display:flex;justify-content:space-between;gap:10px;padding:6px 2px;border-top:1px solid #f1f5f9;text-decoration:none;color:#0f172a">
           <span style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.name)}</span>
           <span style="font-size:11px;color:#64748b;flex-shrink:0">${STATUS_LABEL[l.status] ?? l.status}</span>
         </a>`,
    )
    .join("");
  const more = p.count > p.leads.length ? `<div style="font-size:11px;color:#94a3b8;padding-top:6px">+${p.count - p.leads.length} more</div>` : "";
  return `<div style="min-width:200px;max-width:260px">
      <div style="font-weight:800;color:#0E2A47;font-size:14px">${esc(p.zip)} · ${p.count} lead${p.count === 1 ? "" : "s"}</div>
      ${p.place ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">${esc(p.place)}</div>` : ""}
      <div style="max-height:220px;overflow:auto;margin-top:4px">${rows}</div>
      ${more}
    </div>`;
}

export function LeadsMap({ points, token }: { points: MapPoint[]; token: string | undefined }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pins" | "heat">("pins");

  // Statuses actually present, in pipeline order — drives the legend.
  const legend = useMemo(() => {
    const seen = new Set<string>();
    for (const p of points) for (const s in p.statusCounts) if (p.statusCounts[s]) seen.add(s);
    return STATUS_ORDER.filter((s) => seen.has(s));
  }, [points]);

  // Create the map once we have a token + container.
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = token;
        glRef.current = mapboxgl;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [-117.4, 34.05], // Inland Empire
          zoom: 8,
          attributionControl: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => { if (!cancelled) { mapRef.current = map; setReady(true); } });
        map.on("error", (e: { error?: { message?: string } }) => {
          const msg = e?.error?.message || "";
          if (/access token|401|unauthorized/i.test(msg)) setError("Mapbox rejected the token — double-check NEXT_PUBLIC_MAPBOX_TOKEN.");
        });
      } catch {
        if (!cancelled) setError("Couldn't load the map library.");
      }
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // (Re)draw markers whenever points change.
  useEffect(() => {
    const map = mapRef.current, mapboxgl = glRef.current;
    if (!ready || !map || !mapboxgl) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (points.length === 0) return;

    const max = points.reduce((m, p) => Math.max(m, p.count), 1);
    const bounds = new mapboxgl.LngLatBounds();

    for (const p of points) {
      const size = markerSize(p.count, max);
      const thickness = Math.max(5, Math.round(size * 0.2)); // donut ring width

      // Marker root — Mapbox sets position:absolute + transform on this to place
      // it by lng/lat, so we must NOT override its position. The donut lives as a
      // child (position:relative) so the inner hole positions against it, not here.
      const el = document.createElement("div");
      el.style.cursor = "pointer";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      // Outer ring = conic gradient of the zip's status mix.
      const donut = document.createElement("div");
      Object.assign(donut.style, {
        width: `${size}px`, height: `${size}px`, borderRadius: "50%",
        background: ringGradient(p.statusCounts, p.count),
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)", position: "relative",
      } as Partial<CSSStyleDeclaration>);

      // Inner white hole with the total count.
      const inner = document.createElement("div");
      inner.textContent = String(p.count);
      const innerSize = size - thickness * 2;
      Object.assign(inner.style, {
        position: "absolute", inset: `${thickness}px`, borderRadius: "50%",
        background: "#ffffff", color: "#0f172a", fontWeight: "700",
        fontSize: `${Math.max(10, Math.min(15, innerSize / 2.3))}px`,
        display: "flex", alignItems: "center", justifyContent: "center",
      } as Partial<CSSStyleDeclaration>);
      donut.appendChild(inner);
      el.appendChild(donut);

      const popup = new mapboxgl.Popup({ offset: size / 2 + 4, closeButton: true, maxWidth: "280px" }).setHTML(popupHTML(p));
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.lng, p.lat]);
    }

    // Heatmap source/layer weighted by lead count per zip.
    const fc = {
      type: "FeatureCollection",
      features: points.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { count: p.count } })),
    };
    const maxCount = Math.max(max, 1);
    if (map.getSource("leads-heat")) {
      map.getSource("leads-heat").setData(fc);
    } else {
      map.addSource("leads-heat", { type: "geojson", data: fc });
      map.addLayer({
        id: "leads-heat-layer",
        type: "heatmap",
        source: "leads-heat",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, maxCount, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 11, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 12, 9, 30, 12, 48],
          "heatmap-opacity": 0.82,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(13,148,136,0)",
            0.2, "#99f6e4",
            0.4, "#2dd4bf",
            0.6, "#facc15",
            0.8, "#f97316",
            1, "#ef4444",
          ],
        },
      });
    }

    if (points.length === 1) {
      map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 10, duration: 500 });
    } else {
      map.fitBounds(bounds, { padding: 70, maxZoom: 11, duration: 500 });
    }
  }, [points, ready]);

  // Toggle between donut pins and the heatmap layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach((m) => { m.getElement().style.display = mode === "heat" ? "none" : ""; });
    if (map.getLayer("leads-heat-layer")) {
      map.setLayoutProperty("leads-heat-layer", "visibility", mode === "heat" ? "visible" : "none");
    }
  }, [mode, ready, points]);

  if (!token) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-navy-900 font-semibold">Map needs a Mapbox token</p>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Add a free Mapbox access token as <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your
          Vercel environment variables, then redeploy. Get one at{" "}
          <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">account.mapbox.com</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: "70vh", minHeight: 420 }} />

      {/* Pins / Heatmap toggle */}
      <div className="absolute top-3 left-3 z-10 flex bg-white rounded-lg shadow border border-gray-200 overflow-hidden text-sm font-medium">
        <button onClick={() => setMode("pins")} className={`px-3 py-1.5 ${mode === "pins" ? "bg-navy-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Pins</button>
        <button onClick={() => setMode("heat")} className={`px-3 py-1.5 ${mode === "heat" ? "bg-navy-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Heatmap</button>
      </div>

      {/* Legend — status colors for pins, density scale for the heatmap */}
      {mode === "pins" && legend.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 px-3 py-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</div>
          <div className="flex flex-col gap-1">
            {legend.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === "heat" && points.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 px-3 py-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Lead density</div>
          <div className="h-2 w-32 rounded" style={{ background: "linear-gradient(90deg,#99f6e4,#2dd4bf,#facc15,#f97316,#ef4444)" }} />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>Low</span><span>High</span></div>
        </div>
      )}
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg shadow">{error}</div>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading map…</div>
      )}
    </div>
  );
}
