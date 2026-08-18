"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, X, UserPlus, Loader2 } from "lucide-react";
import { enqueue } from "@/lib/pwa/canvasser-outbox";

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

  // Load existing pins.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/canvasser/visits")
      .then((r) => (r.ok ? r.json() : { visits: [] }))
      .then((d) => { if (!cancelled) setVisits((d.visits ?? []) as VisitRow[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
        style: "mapbox://styles/mapbox/streets-v12",
        center: IE_CENTER,
        zoom: 12,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => { if (!cancelled) { map.resize(); setReady(true); } });

      // Tap to drop a pin.
      map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        const clientKey = uuid();
        const row: VisitRow = {
          clientKey, lat: e.lngLat.lat, lng: e.lngLat.lng,
          address: null, city: null, zipCode: null, status: "NOT_HOME", notes: null, canvasserLeadId: null, pending: true,
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
          const marker = new mapboxgl!.Marker({ element: el, anchor: "bottom" }).setLngLat([v.lng, v.lat]).addTo(map);
          markersRef.current.set(v.clientKey, marker);
        }
      }
      // Remove markers whose visit disappeared.
      for (const [key, marker] of markersRef.current) {
        if (!seen.has(key)) { marker.remove(); markersRef.current.delete(key); }
      }
    })();
  }, [visits, ready]);

  const locate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 }),
      () => {}, { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const cur = visits.find((v) => v.clientKey === selected) || null;

  const markLead = async () => {
    if (!cur || !leadForm) return;
    setSavingLead(true);
    const leadKey = uuid();
    await enqueue("lead", {
      clientKey: leadKey, visitClientKey: cur.clientKey,
      firstName: leadForm.firstName, lastName: leadForm.lastName, phone: leadForm.phone, email: leadForm.email,
      address: cur.address, city: cur.city, zipCode: cur.zipCode, notes: cur.notes,
    });
    saveVisit({ ...cur, status: "LEAD", canvasserLeadId: "pending" });
    setSavingLead(false);
    setLeadForm(null);
    setSelected(null);
  };

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 116px)", minHeight: 460 }}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden bg-gray-200" />

      {!token && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-[#0b0f1a] rounded-2xl">
          <p className="text-sm text-white/80 max-w-sm">Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map.</p>
        </div>
      )}

      {/* Locate me */}
      <button
        onClick={locate}
        className="absolute left-3 bottom-3 z-10 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white shadow-lg text-[13px] font-bold text-gray-800 active:scale-95"
      >
        <Crosshair className="w-4 h-4 text-blue-600" /> Locate me
      </button>

      <p className="absolute left-3 top-3 z-10 text-[11px] font-medium text-gray-700 bg-white/90 rounded-full px-2.5 py-1 shadow">
        Tap the map to drop a pin
      </p>

      {/* Detail sheet */}
      {cur && (
        <div className="absolute left-0 right-0 bottom-0 z-20 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,.18)] p-4 max-h-[70%] overflow-auto">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900 truncate">
                {cur.address || (cur.pending ? "Locating address…" : "Dropped pin")}
              </p>
              <p className="text-[12px] text-gray-500">{[cur.city, cur.zipCode].filter(Boolean).join(", ") || `${cur.lat.toFixed(5)}, ${cur.lng.toFixed(5)}`}</p>
            </div>
            <button onClick={() => { setSelected(null); setLeadForm(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
          </div>

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
        </div>
      )}
    </div>
  );
}
