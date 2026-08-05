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
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    let fellBack = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: [-117.4, 34.05],
        zoom: 9,
        pitch: 0,
        attributionControl: false,
      });
      mapRef.current = map;
      glRef.current = mapboxgl;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("style.load", () => { try { map.setConfigProperty("basemap", "lightPreset", "day"); } catch {} });
      map.on("load", () => { if (!cancelled) { setReady(true); map.resize(); } });
      map.on("error", (e: { error?: { message?: string } }) => {
        const msg = e?.error?.message || "map error";
        // If the 3D Standard style fails for any reason, fall back to a plain
        // style once so the user still gets a working map with pins.
        if (!fellBack && /style|standard|not\s*found|sprite|glyph/i.test(msg)) {
          fellBack = true;
          try { map.setStyle("mapbox://styles/mapbox/light-v11"); return; } catch {}
        }
        if (/access token|401|403|unauthorized/i.test(msg)) setError("Mapbox rejected the token — check NEXT_PUBLIC_MAPBOX_TOKEN.");
      });

      // ResizeObserver keeps the GL canvas matched to the container as the page
      // chrome settles — fixes half-rendered / black maps reliably.
      ro = new ResizeObserver(() => {
        if (mapRef.current && containerRef.current && containerRef.current.clientHeight > 0) mapRef.current.resize();
      });
      ro.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // Drop a pin per customer once the map is ready.
  useEffect(() => {
    const map = mapRef.current, mapboxgl = glRef.current;
    if (!ready || !map || !mapboxgl) return;
    map.resize(); // make sure the canvas is sized before fitBounds projects — a
                  // 0-size canvas yields NaN bounds and a permanently blank map.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (customers.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const c of customers) {
      const el = document.createElement("div");
      // No position — Mapbox sets position:absolute to place the marker.
      el.style.cssText = "width:34px;height:34px;cursor:pointer;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))";
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
    <div className="relative w-full">
      {/* Explicitly-sized, in-flow map div (like the leads map) so Mapbox gets a
          real height at init — an absolute inset-0 div can init at 0 and render blank. */}
      <div ref={containerRef} className="w-full rounded-2xl overflow-hidden bg-gray-200" style={{ height: "calc(100vh - 210px)", minHeight: 560 }} />

      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a]">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}
      {token && !ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading map…</div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg shadow">{error}</div>
      )}

      {token && !selected && ready && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-neutral-800/70 backdrop-blur-xl text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {customers.length} customer{customers.length === 1 ? "" : "s"} on the map · tap a pin for details
          {uncoded > 0 && <span className="text-white/50"> · {uncoded} still locating</span>}
        </div>
      )}

      {selected && <CustomerInfoPanels customer={selected} token={token} onClose={closePanel} />}
    </div>
  );
}
