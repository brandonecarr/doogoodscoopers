"use client";

import { useEffect, useRef, useState } from "react";
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
  leads: MapLead[];
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", NO_ANSWER: "No Answer",
  NOT_INTERESTED: "Lost", WAITING_FOR_SIGNUP: "Quoted", CONVERTED: "Won", PHONE_REVIEW: "Phone Review",
};

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
      const el = document.createElement("div");
      el.textContent = String(p.count);
      Object.assign(el.style, {
        width: `${size}px`, height: `${size}px`, borderRadius: "50%",
        background: "rgba(13,148,136,0.88)", border: "2px solid #ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)", color: "#ffffff",
        fontWeight: "700", fontSize: `${Math.max(11, Math.min(16, size / 3))}px`,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);

      const popup = new mapboxgl.Popup({ offset: size / 2 + 4, closeButton: true, maxWidth: "280px" }).setHTML(popupHTML(p));
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.lng, p.lat]);
    }

    if (points.length === 1) {
      map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 10, duration: 500 });
    } else {
      map.fitBounds(bounds, { padding: 70, maxZoom: 11, duration: 500 });
    }
  }, [points, ready]);

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
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg shadow">{error}</div>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading map…</div>
      )}
    </div>
  );
}
