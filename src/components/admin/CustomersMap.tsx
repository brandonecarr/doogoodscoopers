"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { CustomerInfoPanels, pawSvg, type MapCustomer } from "./CustomerInfoPanels";

// All customers as violet paw pins on a 3D Mapbox map. Click a pin to fly in
// and show that customer's immersive card + service schedule.
export function CustomersMap({ customers, token, uncoded }: { customers: MapCustomer[]; token: string | undefined; uncoded: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [selected, setSelected] = useState<MapCustomer | null>(null);
  const [ready, setReady] = useState(false);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      glRef.current = mapboxgl;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: [-117.4, 34.05],
        zoom: 9, pitch: 0, antialias: true, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("style.load", () => { try { map.setConfigProperty("basemap", "lightPreset", "day"); } catch {} });
      map.on("load", () => { if (!cancelled) setReady(true); });
    })();
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Drop a pin per customer once the map is ready.
  useEffect(() => {
    const map = mapRef.current, mapboxgl = glRef.current;
    if (!ready || !map || !mapboxgl) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (customers.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const c of customers) {
      const el = document.createElement("div");
      el.style.cssText = "width:34px;height:34px;position:relative;cursor:pointer;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))";
      el.innerHTML = `<div style="width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(45deg);background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;border:2px solid #fff"><img src="${pawSvg("#ffffff")}" style="width:16px;height:16px;transform:rotate(-45deg)"/></div>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(byId.get(c.id) || c);
        map.flyTo({ center: [c.lng, c.lat], zoom: 16.4, pitch: 58, bearing: -18, duration: 1100 });
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([c.lng, c.lat]).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([c.lng, c.lat]);
    }
    try { map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 0 }); } catch {}
  }, [ready, customers, byId]);

  const closePanel = () => {
    setSelected(null);
    const map = mapRef.current, mapboxgl = glRef.current;
    if (map && mapboxgl && customers.length) {
      const bounds = new mapboxgl.LngLatBounds();
      customers.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      try { map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 800 }); } catch {}
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0b0f1a]" style={{ height: "calc(100vh - 210px)", minHeight: 560 }}>
      <div ref={containerRef} className="absolute inset-0" />

      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}

      {/* Hint / count pill (when nothing selected) */}
      {token && !selected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-neutral-800/70 backdrop-blur-xl text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {customers.length} customer{customers.length === 1 ? "" : "s"} on the map · tap a pin for details
          {uncoded > 0 && <span className="text-white/50"> · {uncoded} still locating</span>}
        </div>
      )}

      {selected && <CustomerInfoPanels customer={selected} token={token} onClose={closePanel} />}
    </div>
  );
}
