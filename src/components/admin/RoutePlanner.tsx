"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dog, Wand2, Eraser, X, MapPin, Loader2, Info, ChevronDown, ChevronRight, Check, CalendarRange, Crosshair, RotateCcw, Droplets } from "lucide-react";
import { pawSvg, type MapCustomer } from "./CustomerInfoPanels";
import { DAY_NAMES, DAY_SHORT, parseServiceDays, serviceDaysLabel, frequencyLabel } from "@/lib/customer-schedule";
import { DAY_ORDER, UNASSIGNED, dayColor, plannedDay, sprayInfo, SPRAY_COLOR, sprayLabel, weekParity, type SprayFreq } from "@/lib/route-plan";

// Lanes / chips: Mon-first work week, weekend, then Unassigned.
const LANES = [...DAY_ORDER, UNASSIGNED];
const laneName = (d: number) => (d < 0 ? "Unassigned" : DAY_NAMES[d]);
const laneShort = (d: number) => (d < 0 ? "Unassigned" : DAY_SHORT[d]);
const dogTotal = (arr: MapCustomer[]) => arr.reduce((s, c) => s + (c.numberOfDogs || 0), 0);
// City from the "City, CA 92373" line (falls back to the zip when there's no city).
const cityLabel = (c: MapCustomer) => {
  const parts = c.cityLine.split(",");
  return (parts.length > 1 ? parts[0].trim() : c.zipCode) || "—";
};

export function RoutePlanner({
  customers,
  token,
  initialAssignments,
}: {
  customers: MapCustomer[];
  token: string | undefined;
  initialAssignments: Record<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, { marker: any; inner: HTMLDivElement }>>(new Map());

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number>>(initialAssignments);
  const [visible, setVisible] = useState<Set<number>>(() => new Set(LANES));
  const [selected, setSelected] = useState<MapCustomer | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // Right-click context menu for a customer (pin or lane card).
  const [menu, setMenu] = useState<{ x: number; y: number; customer: MapCustomer } | null>(null);
  const [submenu, setSubmenu] = useState(false);
  // Sanitization-spray week view: "both" shows every spray; "a"/"b" split the
  // bi-weekly/monthly ones across alternating weeks (weekly always shows).
  const [week, setWeek] = useState<"both" | "a" | "b">("both");

  function openMenu(x: number, y: number, customer: MapCustomer) {
    setSubmenu(false);
    setMenu({ x, y, customer });
  }
  function closeMenu() { setMenu(null); setSubmenu(false); }

  function toggleCollapse(d: number) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  }
  function expand(d: number) {
    setCollapsed((prev) => (prev.has(d) ? new Set([...prev].filter((x) => x !== d)) : prev));
  }
  const allCollapsed = collapsed.size >= LANES.length;

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Customers with the sanitization-spray add-on → their spray cadence.
  const sprayById = useMemo(() => {
    const m = new Map<string, { freq: SprayFreq }>();
    for (const c of customers) {
      const s = sprayInfo(c.subscriptionNames, c.cleanupFrequency);
      if (s) m.set(c.id, s);
    }
    return m;
  }, [customers]);

  // Whether a customer's spray card shows in the current week view.
  function sprayShown(id: string): boolean {
    const s = sprayById.get(id);
    if (!s) return false;
    if (week === "both" || s.freq === "weekly") return true;
    return weekParity(id) === (week === "a" ? 0 : 1);
  }

  // Fan out customers that share a coordinate so each stays clickable.
  const coords = useMemo(() => {
    const groups = new Map<string, MapCustomer[]>();
    for (const c of customers) {
      const k = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
      const g = groups.get(k);
      if (g) g.push(c);
      else groups.set(k, [c]);
    }
    const m = new Map<string, [number, number]>();
    for (const arr of groups.values()) {
      arr.forEach((c, i) => {
        let lng = c.lng, lat = c.lat;
        if (arr.length > 1) { const ang = (i / arr.length) * 2 * Math.PI, r = 0.00009; lng += r * Math.cos(ang); lat += r * Math.sin(ang); }
        m.set(c.id, [lng, lat]);
      });
    }
    return m;
  }, [customers]);

  const customersRef = useRef(customers); customersRef.current = customers;
  const coordsRef = useRef(coords); coordsRef.current = coords;
  const assignmentsRef = useRef(assignments); assignmentsRef.current = assignments;
  const byIdRef = useRef(byId); byIdRef.current = byId;
  const selectedRef = useRef(selected); selectedRef.current = selected;

  // Group customers into lanes by their planned day.
  const grouped = useMemo(() => {
    const g = new Map<number, MapCustomer[]>();
    for (const d of LANES) g.set(d, []);
    for (const c of customers) g.get(plannedDay(c, assignments))!.push(c);
    for (const arr of g.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [customers, assignments]);

  // Set a customer's day: 0–6 = weekday, -1 = park (Unassigned), null = revert to real day.
  async function assign(customerId: string, day: number | null) {
    setAssignments((prev) => {
      const n = { ...prev };
      if (day == null) delete n[customerId];
      else n[customerId] = day;
      return n;
    });
    setSaving(true);
    try {
      await fetch("/api/admin/route-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dayOfWeek: day }),
      });
    } catch { /* keep the optimistic state; the next save reconciles */ }
    finally { setSaving(false); }
  }

  async function bulk(action: "seedFromServiceDays" | "clearAll") {
    if (action === "clearAll" && !confirm("Clear the whole plan? Customers revert to their real Sweep&Go days.")) return;
    setSaving(true);
    try {
      await fetch("/api/admin/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const r = await fetch("/api/admin/route-plan");
      if (r.ok) setAssignments((await r.json()).assignments || {});
    } catch { /* noop */ }
    finally { setSaving(false); }
  }

  function flyTo(c: MapCustomer) {
    const map = mapRef.current, co = coords.get(c.id);
    if (map && co) map.flyTo({ center: co, zoom: 14.8, duration: 800 });
  }

  // Reframe the whole set of pins (used when a customer card is closed).
  function fitAll(duration = 700) {
    const map = mapRef.current;
    if (!map || coords.size === 0) return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [lng, lat] of coords.values()) { if (lng < w) w = lng; if (lng > e) e = lng; if (lat < s) s = lat; if (lat > n) n = lat; }
    try { map.fitBounds([[w, s], [e, n]], { padding: 70, maxZoom: 13, duration }); } catch {}
  }
  const fitAllRef = useRef(fitAll); fitAllRef.current = fitAll;

  // Close the customer card and zoom back out.
  function closeSelected() { setSelected(null); fitAll(700); }

  function toggleDay(d: number) {
    setVisible((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  }

  // ── Build the map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    const markers = markersRef.current; // stable Map; safe to use in cleanup
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = token;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: any = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-117.4, 34.05], zoom: 9, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      // Clicking empty map (not a pin — pins stopPropagation) closes the card and zooms out.
      map.on("click", () => { if (selectedRef.current) { setSelected(null); fitAllRef.current(700); } });
      map.on("error", (e: { error?: { message?: string } }) => {
        const msg = e?.error?.message || "";
        if (/access token|401|403|unauthorized/i.test(msg)) setError("Mapbox rejected the token — check NEXT_PUBLIC_MAPBOX_TOKEN.");
      });
      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        const cs = customersRef.current, cds = coordsRef.current, as = assignmentsRef.current;
        const b = new mapboxgl.LngLatBounds();
        for (const c of cs) {
          const co = cds.get(c.id);
          if (!co) continue;
          const el = document.createElement("div");
          el.style.cssText = "width:28px;height:28px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))";
          const inner = document.createElement("div");
          inner.style.cssText = "width:28px;height:28px;border-radius:50% 50% 50% 6px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box";
          inner.style.background = dayColor(plannedDay(c, as));
          inner.innerHTML = `<img src="${pawSvg("#ffffff")}" style="width:12px;height:12px;transform:rotate(-45deg)"/>`;
          el.appendChild(inner);
          if (sprayInfo(c.subscriptionNames, c.cleanupFrequency)) {
            const dot = document.createElement("div");
            dot.style.cssText = `position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:${SPRAY_COLOR};border:2px solid #fff;box-sizing:border-box;z-index:1`;
            el.appendChild(dot);
          }
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setSelected(byIdRef.current.get(c.id) || c);
            map.flyTo({ center: co, zoom: 14.8, duration: 800 });
          });
          el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const me = ev as MouseEvent;
            setSubmenu(false);
            setMenu({ x: me.clientX, y: me.clientY, customer: byIdRef.current.get(c.id) || c });
          });
          const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(co).addTo(map);
          markersRef.current.set(c.id, { marker, inner });
          b.extend(co);
        }
        try { map.resize(); if (cs.length) map.fitBounds(b, { padding: 70, maxZoom: 13, duration: 0 }); } catch {}
        setReady(true);
      });
      ro = new ResizeObserver(() => { if (mapRef.current && containerRef.current && containerRef.current.clientHeight > 0) mapRef.current.resize(); });
      ro.observe(containerRef.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // Recolor + filter markers whenever the plan or the day filter changes.
  useEffect(() => {
    if (!ready) return;
    for (const c of customers) {
      const entry = markersRef.current.get(c.id);
      if (!entry) continue;
      const day = plannedDay(c, assignments);
      entry.inner.style.background = dayColor(day);
      entry.marker.getElement().style.display = visible.has(day) ? "" : "none";
    }
  }, [assignments, visible, ready, customers]);

  // Dismiss the context menu on Escape, scroll, or resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(null); setSubmenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const selectedDay = selected ? plannedDay(selected, assignments) : UNASSIGNED;

  return (
    <div className="space-y-3">
      {/* Read-only banner */}
      <div className="dgs-card p-3 flex items-center gap-2.5" style={{ background: "#F7F5FF" }}>
        <Info className="w-4 h-4 flex-shrink-0 text-iris-deep" />
        <p className="text-[13px] text-bodytext">
          Planning scratchpad — drag customers between days or tap a pin to set a day.{" "}
          <span className="text-muted">Nothing here is sent to Sweep&amp;Go.</span>
        </p>
        {saving && <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted"><Loader2 className="w-3.5 h-3.5 animate-spin" /> saving…</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => bulk("seedFromServiceDays")} disabled={saving}
          className="dgs-btn dgs-btn-ghost disabled:opacity-50">
          <Wand2 className="w-4 h-4" /> Seed from Sweep&amp;Go days
        </button>
        <button onClick={() => bulk("clearAll")} disabled={saving}
          className="dgs-btn dgs-btn-ghost disabled:opacity-50">
          <Eraser className="w-4 h-4" /> Clear plan
        </button>

        {sprayById.size > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: SPRAY_COLOR }}>
              <Droplets className="w-3.5 h-3.5" /> Sprays
            </span>
            <div className="flex items-center bg-white rounded-[10px] p-0.5 border border-hair">
              {([["both", "All weeks"], ["a", "Week A"], ["b", "Week B"]] as const).map(([w, label]) => (
                <button key={w} onClick={() => setWeek(w)}
                  className="px-2.5 py-1 rounded-[8px] text-[12px] font-semibold transition-colors"
                  style={week === w ? { background: "#101014", color: "#fff" } : { color: "#5A5A66" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <span className="text-[12px] text-muted ml-auto">{customers.length} customer{customers.length === 1 ? "" : "s"} mapped</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3.5 items-start">
        {/* ── MAP ─────────────────────────────────────────────────────────── */}
        <div className="relative">
          <div ref={containerRef} className="w-full rounded-2xl overflow-hidden bg-gray-200"
            style={{ height: "calc(100vh - 300px)", minHeight: 520 }} />

          {!token && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a] rounded-2xl">
              <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
            </div>
          )}
          {token && !ready && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading map…</div>}
          {error && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg shadow">{error}</div>}

          {/* Day filter chips (also the legend) */}
          {token && ready && (
            <div className="absolute top-3 left-3 right-3 z-10 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {LANES.map((d) => {
                const count = grouped.get(d)?.length ?? 0;
                const on = visible.has(d);
                return (
                  <button key={d} onClick={() => toggleDay(d)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap bg-white/95 backdrop-blur border border-hair shadow-sm transition-opacity"
                    style={{ opacity: on ? 1 : 0.42 }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: dayColor(d) }} />
                    {laneShort(d)}
                    <span className="text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Assign popover for the clicked pin */}
          {selected && (
            <div className="dgs-pop dgs-anim-pop absolute top-16 left-1/2 -translate-x-1/2 z-20 w-[300px] max-w-[calc(100%-24px)] p-3.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-ink truncate">{selected.name}</p>
                  <p className="text-[12px] text-muted truncate">{selected.address}{selected.cityLine ? ` · ${selected.cityLine}` : ""}</p>
                  <p className="text-[11.5px] text-muted mt-1">
                    Real: {frequencyLabel(selected.cleanupFrequency)} · {serviceDaysLabel(parseServiceDays(selected.serviceDays))}
                    {selected.numberOfDogs != null ? ` · ${selected.numberOfDogs} dog${selected.numberOfDogs === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <button onClick={closeSelected} className="p-1 rounded-lg hover:bg-surface2 text-muted flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mt-3 mb-1.5">Plan for</p>
              <div className="grid grid-cols-4 gap-1.5">
                {DAY_ORDER.map((d) => {
                  const on = selectedDay === d;
                  return (
                    <button key={d} onClick={() => assign(selected.id, d)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded-[10px] text-[12px] font-bold transition-colors"
                      style={on ? { background: dayColor(d), color: "#fff" } : { background: "#F4F4F6", color: "#2C2C36" }}>
                      {DAY_SHORT[d]}
                    </button>
                  );
                })}
                <button onClick={() => assign(selected.id, UNASSIGNED)}
                  className="flex items-center justify-center py-1.5 rounded-[10px] text-[12px] font-bold transition-colors"
                  style={selectedDay < 0 ? { background: dayColor(UNASSIGNED), color: "#fff" } : { background: "#F4F4F6", color: "#2C2C36" }}>
                  Off
                </button>
              </div>
              <button onClick={() => assign(selected.id, null)}
                className="mt-2 text-[11.5px] text-iris-link hover:underline">Reset to real Sweep&amp;Go day</button>
            </div>
          )}
        </div>

        {/* ── DAY LANES ───────────────────────────────────────────────────── */}
        <div className="space-y-2.5 lg:max-h-[calc(100vh-300px)] lg:overflow-y-auto lg:pr-1">
          <div className="flex justify-end px-1">
            <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(LANES))}
              className="text-[12px] font-semibold text-iris-link hover:underline">
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
          {LANES.map((d) => {
            const arr = grouped.get(d) ?? [];
            const isOver = dragOver === d;
            const isCollapsed = collapsed.has(d);
            const sprayCount = arr.filter((c) => sprayShown(c.id)).length;
            return (
              <div key={d} className="dgs-card overflow-hidden"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== d) setDragOver(d); if (isCollapsed) expand(d); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((v) => (v === d ? null : v)); }}
                onDrop={(e) => { e.preventDefault(); if (dragId) assign(dragId, d); setDragId(null); setDragOver(null); }}
                style={isOver ? { boxShadow: "0 0 0 2px #8B6BFF inset" } : undefined}>
                {/* Lane header — click to collapse/expand */}
                <button type="button" onClick={() => toggleCollapse(d)}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-left ${isCollapsed ? "" : "border-b border-hairline"}`}>
                  <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dayColor(d) }} />
                  <span className="text-[13.5px] font-extrabold text-ink">{laneName(d)}</span>
                  <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted">
                    <span>{arr.length}</span>
                    {dogTotal(arr) > 0 && <span className="inline-flex items-center gap-0.5"><Dog className="w-3.5 h-3.5" />{dogTotal(arr)}</span>}
                    {sprayCount > 0 && <span className="inline-flex items-center gap-0.5" style={{ color: SPRAY_COLOR }}><Droplets className="w-3.5 h-3.5" />{sprayCount}</span>}
                  </span>
                </button>
                {/* Lane body */}
                {!isCollapsed && (
                <div className="p-2 space-y-1.5 min-h-[52px]">
                  {arr.length === 0 ? (
                    <div className="flex items-center justify-center h-[44px] text-[12px] text-muted">
                      {isOver ? "Drop here" : "—"}
                    </div>
                  ) : (
                    arr.map((c) => {
                      const spray = sprayById.get(c.id);
                      return (
                      <div key={c.id} className="space-y-1.5">
                        {/* Scooping (service) card — draggable */}
                        <div draggable
                          onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                          onClick={() => { setSelected(c); flyTo(c); }}
                          onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, c); }}
                          className={`dgs-tile px-2.5 py-2 cursor-grab active:cursor-grabbing transition-opacity ${dragId === c.id ? "opacity-40" : ""}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dayColor(d) }} />
                            <p className="text-[13px] font-bold text-ink truncate flex-1">{c.name}</p>
                            {c.numberOfDogs != null && c.numberOfDogs > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted flex-shrink-0"><Dog className="w-3 h-3" />{c.numberOfDogs}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted truncate mt-0.5 pl-4">{cityLabel(c)}</p>
                          <p className="text-[10.5px] text-muted truncate pl-4">
                            {frequencyLabel(c.cleanupFrequency)} · real: {serviceDaysLabel(parseServiceDays(c.serviceDays))}
                          </p>
                        </div>
                        {/* Sanitization-spray card — follows the customer's assigned day */}
                        {spray && sprayShown(c.id) && (
                          <div onClick={() => { setSelected(c); flyTo(c); }}
                            onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, c); }}
                            className="rounded-[14px] px-2.5 py-2 cursor-pointer"
                            style={{ background: "#E7F6F4", boxShadow: `inset 3px 0 0 ${SPRAY_COLOR}` }}>
                            <div className="flex items-center gap-2">
                              <Droplets className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SPRAY_COLOR }} />
                              <p className="text-[12.5px] font-bold text-ink truncate flex-1">Sanitization spray</p>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: "#fff", color: SPRAY_COLOR }}>{sprayLabel(spray.freq)}</span>
                            </div>
                            <p className="text-[11px] text-muted truncate mt-0.5 pl-5">{c.name} · {cityLabel(c)}</p>
                          </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-muted px-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Tap a card to find it on the map. Right-click for options.
          </p>
        </div>
      </div>

      {/* Right-click context menu (map pin or lane card) */}
      {menu && (() => {
        const MENU_W = 240, MENU_H = 196, SUB_W = 170;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const x = Math.max(8, Math.min(menu.x, vw - MENU_W - 8));
        const y = Math.max(8, Math.min(menu.y, vh - MENU_H - 8));
        const openLeft = x + MENU_W + SUB_W > vw - 8;
        const cur = plannedDay(menu.customer, assignments);
        const item = "w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[13px] font-semibold text-bodytext hover:bg-surface2 transition-colors";
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
            <div className="dgs-pop dgs-anim-pop fixed z-50 p-1.5" style={{ left: x, top: y, width: MENU_W }}>
              <div className="px-2.5 py-1.5 mb-1 border-b border-hairline">
                <p className="text-[12.5px] font-extrabold text-ink truncate">{menu.customer.name}</p>
                <p className="text-[10.5px] text-muted truncate">{cityLabel(menu.customer)}</p>
              </div>

              {/* Change service day → submenu of days */}
              <div className="relative" onMouseEnter={() => setSubmenu(true)} onMouseLeave={() => setSubmenu(false)}>
                <button type="button" onClick={() => setSubmenu((v) => !v)} className={`${item} justify-between`}>
                  <span className="flex items-center gap-2"><CalendarRange className="w-4 h-4 text-muted" /> Change service day</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted" />
                </button>
                {submenu && (
                  <div className="dgs-pop absolute top-[-6px] p-1.5 max-h-[300px] overflow-auto"
                    style={openLeft ? { right: "100%", marginRight: 4, width: SUB_W } : { left: "100%", marginLeft: 4, width: SUB_W }}>
                    {LANES.map((dz) => (
                      <button key={dz} type="button" onClick={() => { assign(menu.customer.id, dz); closeMenu(); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12.5px] font-semibold text-bodytext hover:bg-surface2 transition-colors">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dayColor(dz) }} />
                        <span className="flex-1 text-left">{laneName(dz)}</span>
                        {cur === dz && <Check className="w-3.5 h-3.5 text-iris-deep flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => { setSelected(menu.customer); flyTo(menu.customer); closeMenu(); }} className={item}>
                <Crosshair className="w-4 h-4 text-muted" /> Find on map
              </button>
              <button type="button" onClick={() => { assign(menu.customer.id, null); closeMenu(); }} className={item}>
                <RotateCcw className="w-4 h-4 text-muted" /> Reset to real Sweep&amp;Go day
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}
