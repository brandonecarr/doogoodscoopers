"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

// Read-only office map of every canvasser's dropped pins, color-coded by
// disposition. Click a pin for its address, status, rep, and notes.

export interface OverviewPin {
  lat: number;
  lng: number;
  status: string;
  address: string | null;
  canvasserName: string;
  notes: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  NOT_HOME: "#9CA3AF", CALLBACK: "#F59E0B", INTERESTED: "#2563EB",
  NOT_INTERESTED: "#EF4444", LEAD: "#16A34A", DO_NOT_KNOCK: "#111827",
};
const STATUS_LABEL: Record<string, string> = {
  NOT_HOME: "Not home", CALLBACK: "Call back", INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested", LEAD: "Lead", DO_NOT_KNOCK: "Do not knock",
};
const colorFor = (s: string) => STATUS_COLOR[s] ?? "#9CA3AF";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function CanvassersOverviewMap({ token, pins }: { token: string | undefined; pins: OverviewPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-117.4, 34.05],
        zoom: 9,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        const bounds = new mapboxgl.LngLatBounds();
        let any = false;
        for (const p of pins) {
          if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
          any = true;
          const el = document.createElement("div");
          el.innerHTML = `<div style="width:16px;height:16px;border-radius:50% 50% 50% 2px;transform:rotate(45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);background:${colorFor(p.status)}"></div>`;
          const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(
            `<div style="font:13px/1.4 system-ui;padding:2px 2px 4px"><div style="font-weight:700">${esc(p.address || "Dropped pin")}</div>` +
            `<div style="color:${colorFor(p.status)};font-weight:600">${esc(STATUS_LABEL[p.status] ?? p.status)}</div>` +
            `<div style="color:#6B7280">${esc(p.canvasserName || "—")}</div>` +
            (p.notes ? `<div style="color:#374151;margin-top:3px">${esc(p.notes)}</div>` : "") + `</div>`
          );
          new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
          bounds.extend([p.lng, p.lat]);
        }
        if (any) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      });
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [token, pins]);

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="w-full rounded-2xl overflow-hidden bg-gray-200" style={{ height: "calc(100vh - 320px)", minHeight: 420 }} />
      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a] rounded-2xl">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}
    </div>
  );
}
