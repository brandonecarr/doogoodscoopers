"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { CustomerInfoPanels, pawSvg, type MapCustomer } from "./CustomerInfoPanels";

function pinEl(): HTMLDivElement {
  const el = document.createElement("div");
  // No position — Mapbox sets position:absolute to place the marker by lng/lat.
  el.style.cssText = "width:34px;height:34px;cursor:pointer;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))";
  el.innerHTML = `<div style="width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(45deg);background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;border:2px solid #fff"><img src="${pawSvg("#ffffff")}" style="width:16px;height:16px;transform:rotate(-45deg)"/></div>`;
  return el;
}
function clusterEl(count: number): HTMLDivElement {
  const size = count < 10 ? 36 : count < 30 ? 44 : 52;
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border:3px solid #fff;box-shadow:0 3px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:system-ui,-apple-system,sans-serif`;
  el.textContent = String(count);
  return el;
}

// All customers on a 3D Mapbox map, clustered by proximity. Customers at the
// exact same address are fanned out into a small ring so each is clickable.
export function CustomersMap({ customers, token, uncoded }: { customers: MapCustomer[]; token: string | undefined; uncoded: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onScreenRef = useRef<Record<string, any>>({});
  const [selected, setSelected] = useState<MapCustomer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // GeoJSON features, fanning out customers that share a coordinate.
  const features = useMemo(() => {
    const groups = new Map<string, MapCustomer[]>();
    for (const c of customers) {
      const k = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
      const g = groups.get(k);
      if (g) g.push(c); else groups.set(k, [c]);
    }
    const feats: { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { id: string } }[] = [];
    for (const arr of groups.values()) {
      arr.forEach((c, i) => {
        let lng = c.lng, lat = c.lat;
        if (arr.length > 1) { const ang = (i / arr.length) * 2 * Math.PI, r = 0.00009; lng += r * Math.cos(ang); lat += r * Math.sin(ang); }
        feats.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { id: c.id } });
      });
    }
    return feats;
  }, [customers]);

  const featuresRef = useRef(features); featuresRef.current = features;
  const byIdRef = useRef(byId); byIdRef.current = byId;

  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    let fellBack = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      glRef.current = mapboxgl;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: any = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: [-117.4, 34.05], zoom: 9, pitch: 0, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("style.load", () => { try { map.setConfigProperty("basemap", "lightPreset", "day"); } catch {} });
      map.on("error", (e: { error?: { message?: string } }) => {
        const msg = e?.error?.message || "map error";
        if (!fellBack && /style|standard|not\s*found|sprite|glyph/i.test(msg)) { fellBack = true; try { map.setStyle("mapbox://styles/mapbox/light-v11"); return; } catch {} }
        if (/access token|401|403|unauthorized/i.test(msg)) setError("Mapbox rejected the token — check NEXT_PUBLIC_MAPBOX_TOKEN.");
      });

      const fitAll = () => {
        const fs = featuresRef.current;
        if (!fs.length) return;
        const b = new mapboxgl.LngLatBounds();
        fs.forEach((f) => b.extend(f.geometry.coordinates));
        try { map.resize(); map.fitBounds(b, { padding: 80, maxZoom: 13, duration: 0 }); } catch {}
      };

      const updateMarkers = () => {
        const newMarkers: Record<string, unknown> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feats = map.querySourceFeatures("customers") as any[];
        for (const f of feats) {
          const coords = f.geometry.coordinates as [number, number];
          const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
          const key = props.cluster ? `c${props.cluster_id}` : `p${props.id}`;
          let marker = markersRef.current[key];
          if (!marker) {
            if (props.cluster) {
              const el = clusterEl(props.point_count || 0);
              const cid = props.cluster_id;
              el.addEventListener("click", () => {
                map.getSource("customers").getClusterExpansionZoom(cid, (err: unknown, zoom: number) => {
                  if (!err) map.easeTo({ center: coords, zoom: Math.min(zoom, 17), duration: 700 });
                });
              });
              marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(coords);
            } else {
              const el = pinEl();
              const pid = props.id as string;
              el.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const c = byIdRef.current.get(pid);
                if (c) { setSelected(c); map.flyTo({ center: coords, zoom: 16.4, pitch: 58, bearing: -18, duration: 1100 }); }
              });
              marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(coords);
            }
            markersRef.current[key] = marker;
          }
          newMarkers[key] = marker;
          if (!onScreenRef.current[key]) marker.addTo(map);
        }
        for (const k in onScreenRef.current) if (!newMarkers[k]) onScreenRef.current[k].remove();
        onScreenRef.current = newMarkers;
      };

      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        map.resize();
        map.addSource("customers", { type: "geojson", data: { type: "FeatureCollection", features: featuresRef.current }, cluster: true, clusterRadius: 46, clusterMaxZoom: 15 });
        map.addLayer({ id: "_cust_hit", type: "circle", source: "customers", paint: { "circle-radius": 0, "circle-opacity": 0 } });
        map.on("render", () => { if (map.getSource("customers") && map.isSourceLoaded("customers")) updateMarkers(); });
        fitAll();
      });

      ro = new ResizeObserver(() => { if (mapRef.current && containerRef.current && containerRef.current.clientHeight > 0) mapRef.current.resize(); });
      ro.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      Object.values(onScreenRef.current).forEach((m) => m.remove());
      markersRef.current = {}; onScreenRef.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // Update the source when the customer set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getSource("customers")) return;
    map.getSource("customers").setData({ type: "FeatureCollection", features });
  }, [features, ready]);

  const closePanel = () => {
    setSelected(null);
    const map = mapRef.current, mapboxgl = glRef.current;
    if (map && mapboxgl && features.length) {
      const b = new mapboxgl.LngLatBounds();
      features.forEach((f) => b.extend(f.geometry.coordinates));
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      try { map.fitBounds(b, { padding: 80, maxZoom: 13, duration: 800 }); } catch {}
    }
  };

  return (
    <div className="relative w-full">
      {/* In-flow, explicitly-sized map div so Mapbox gets a real height at init. */}
      <div ref={containerRef} className="w-full rounded-2xl overflow-hidden bg-gray-200" style={{ height: "calc(100vh - 210px)", minHeight: 560 }} />

      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a] rounded-2xl">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}
      {token && !ready && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading map…</div>}
      {error && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg shadow">{error}</div>}

      {token && !selected && ready && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-neutral-800/70 backdrop-blur-xl text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {customers.length} customer{customers.length === 1 ? "" : "s"} · tap a pin, or a number to zoom in
          {uncoded > 0 && <span className="text-white/50"> · {uncoded} still locating</span>}
        </div>
      )}

      {selected && <CustomerInfoPanels customer={selected} token={token} onClose={closePanel} />}
    </div>
  );
}
