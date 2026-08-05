"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { CustomerInfoPanels, pawSvg, type MapCustomer } from "./CustomerInfoPanels";

export type { MapCustomer };

// Single-customer immersive map: 3D Mapbox Standard + the shared info panels.
export function CustomerMapView({ customer, token }: { customer: MapCustomer; token: string | undefined }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: [customer.lng, customer.lat],
        zoom: 16.4, pitch: 58, bearing: -18, antialias: true, attributionControl: false,
      });
      mapRef.current = map;
      map.on("style.load", () => {
        try { map.setConfigProperty("basemap", "lightPreset", "day"); } catch {}
        try { map.setConfigProperty("basemap", "showPointOfInterestLabels", true); } catch {}
      });
      const el = document.createElement("div");
      // No position — Mapbox needs position:absolute on the marker element to place it.
      el.style.cssText = "width:52px;height:52px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))";
      el.innerHTML = `<div style="width:52px;height:52px;border-radius:50% 50% 50% 8px;transform:rotate(45deg);background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;border:3px solid #fff"><img src="${pawSvg("#ffffff")}" style="width:24px;height:24px;transform:rotate(-45deg)"/></div>`;
      new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([customer.lng, customer.lat]).addTo(map);
    })();
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { cancelled = true; window.removeEventListener("resize", onResize); mapRef.current?.remove(); mapRef.current = null; };
  }, [token, customer.lng, customer.lat]);

  useEffect(() => { const t = setTimeout(() => mapRef.current?.resize(), 300); return () => clearTimeout(t); });

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0b0f1a] flex flex-col lg:block" style={{ height: "calc(100vh - 130px)", minHeight: 560 }}>
      <div ref={containerRef} className="w-full h-64 lg:h-full lg:absolute lg:inset-0" />
      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}
      <CustomerInfoPanels customer={customer} token={token} />
    </div>
  );
}
