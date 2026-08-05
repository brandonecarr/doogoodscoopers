"use client";

import { useMemo, useState } from "react";
import { MapPin, Clock, Flag, Phone, Mail, Navigation, BarChart3, Check, Dog, CalendarDays, X } from "lucide-react";
import { DAY_SHORT, parseServiceDays, serviceDaysLabel, nextVisit, frequencyLabel } from "@/lib/customer-schedule";

export interface MapCustomer {
  id: string;
  name: string;
  firstName: string;
  address: string;
  cityLine: string;
  zipCode: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  numberOfDogs: number | null;
  cleanupFrequency: string;
  serviceDays: string;
  subscriptionNames: string;
  assignedTo: string;
  startDate: string | null; // ISO
  oneTimeClient: boolean;
}

export function pawSvg(fill: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='${fill}'><ellipse cx='50' cy='63' rx='23' ry='19'/><ellipse cx='24' cy='41' rx='9.5' ry='13'/><ellipse cx='41' cy='27' rx='9.5' ry='13'/><ellipse cx='59' cy='27' rx='9.5' ry='13'/><ellipse cx='76' cy='41' rx='9.5' ry='13'/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// The frosted info card + Service Schedule panel, shared by the single-customer
// map view and the all-customers map (shown for the selected pin).
export function CustomerInfoPanels({ customer, token, onClose }: { customer: MapCustomer; token: string | undefined; onClose?: () => void }) {
  const [heroIdx, setHeroIdx] = useState(0);

  const sched = useMemo(() => {
    const days = parseServiceDays(customer.serviceDays);
    return { days, label: serviceDaysLabel(days), next: nextVisit(days, new Date()) };
  }, [customer.serviceDays]);

  const startedLabel = useMemo(
    () => (customer.startDate ? new Date(customer.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""),
    [customer.startDate],
  );
  const nextLabel = sched.next ? sched.next.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";
  const nextDayShort = sched.next ? DAY_SHORT[sched.next.getDay()] : "";

  const heroes = token
    ? [
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${customer.lng},${customer.lat},16.5,0/620x380@2x?access_token=${token}&attribution=false&logo=false`,
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+7c3aed(${customer.lng},${customer.lat})/${customer.lng},${customer.lat},14.5,0/620x380@2x?access_token=${token}&attribution=false&logo=false`,
      ]
    : [];

  const dogs = customer.numberOfDogs ?? 0;
  const plan = customer.subscriptionNames
    ? customer.subscriptionNames.split(",").map((s) => s.trim()).filter(Boolean).join(" · ")
    : "Scheduled cleanup";
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([customer.address, customer.cityLine].filter(Boolean).join(", "))}`;

  const infoRow = (Icon: typeof MapPin, main: React.ReactNode, sub?: React.ReactNode, accent?: string) => (
    <div className="flex items-start gap-3 py-3">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent || "#6b7280" }} />
      <div className="min-w-0">
        <div className={`text-sm font-medium ${accent ? "" : "text-navy-900"}`} style={accent ? { color: accent } : undefined}>{main}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  return (
    <>
      {/* Left card */}
      <div className="relative lg:absolute lg:top-4 lg:left-4 lg:bottom-4 lg:w-[380px] z-10 overflow-y-auto
                      bg-white/80 lg:bg-white/75 backdrop-blur-2xl lg:rounded-3xl border border-white/60 shadow-2xl">
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">
            <X className="w-4 h-4" />
          </button>
        )}
        {heroes.length > 0 && (
          <div className="relative m-3 mb-0 rounded-2xl overflow-hidden aspect-[16/10] bg-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroes[heroIdx]} alt="" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {heroes.map((_, i) => (
                <button key={i} onClick={() => setHeroIdx(i)} className={`w-1.5 h-1.5 rounded-full ${i === heroIdx ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pawSvg("#ffffff")} alt="" className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-navy-900 leading-tight">{customer.name}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <Dog className="w-3.5 h-3.5" /> {dogs} {dogs === 1 ? "dog" : "dogs"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
              <CalendarDays className="w-3.5 h-3.5" /> {frequencyLabel(customer.cleanupFrequency)}
            </span>
            {customer.oneTimeClient && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">One-time</span>}
          </div>

          <div className="border-t border-gray-200/70 mt-4" />
          {infoRow(MapPin, customer.address, customer.cityLine)}
          <div className="border-t border-gray-200/70" />
          {infoRow(
            Clock,
            <span>{customer.oneTimeClient ? "One-time client" : "Active customer"}</span>,
            sched.next ? `Next visit ${nextLabel}` : startedLabel ? `Customer since ${startedLabel}` : undefined,
            "#059669",
          )}
          <div className="border-t border-gray-200/70" />
          {infoRow(Flag, plan, `Assigned to ${customer.assignedTo || "—"}`)}

          <div className="border-t border-gray-200/70 pt-3 mt-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy-900 mb-1">
              <Dog className="w-4 h-4 text-violet-500" /> Service details
            </div>
            <ul className="space-y-1.5 mt-2">
              {[
                `${dogs} ${dogs === 1 ? "dog" : "dogs"}`,
                `${frequencyLabel(customer.cleanupFrequency)} cleanups`,
                `Serviced on ${sched.label}`,
                `Tech: ${customer.assignedTo || "—"}`,
              ].map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200/70 mt-3" />
          {customer.phone && infoRow(Phone, <a href={`tel:${customer.phone}`} className="hover:text-violet-600">{customer.phone}</a>)}
          {customer.email && (<><div className="border-t border-gray-200/70" />{infoRow(Mail, <a href={`mailto:${customer.email}`} className="hover:text-violet-600 break-all">{customer.email}</a>)}</>)}

          <div className="flex gap-2 mt-4">
            <a href={`/admin/customers/${customer.id}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-navy-900 font-semibold hover:bg-gray-50">
              Profile
            </a>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
              <Navigation className="w-4 h-4" /> Directions
            </a>
          </div>
        </div>
      </div>

      {/* Right: Service Schedule */}
      <div className="relative lg:absolute lg:top-4 lg:right-4 lg:w-[380px] z-10 m-3 lg:m-0
                      bg-neutral-800/70 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl text-white p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-300" />
          <h2 className="text-lg font-bold">Service Schedule</h2>
        </div>
        <p className="text-sm text-white/60 mt-0.5">Serviced: {sched.label}</p>

        <div className="mt-4 rounded-2xl bg-black/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: "#c4b5fd", color: "#4c1d95" }}>{nextDayShort || "—"}</span>
              <span className="text-sm text-white/80">Next visit {nextLabel}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-xs font-medium">{frequencyLabel(customer.cleanupFrequency)}</span>
          </div>

          <div className="flex items-end gap-1.5" style={{ height: 104 }}>
            {DAY_SHORT.map((d, i) => {
              const isService = sched.days.includes(i);
              const isNext = sched.next?.getDay() === i;
              const px = isService ? 104 : 22 + ((i * 13) % 20);
              return (
                <div key={i} className="flex-1 rounded-md relative" style={{ height: px, background: isService ? (isNext ? "#8b5cf6" : "#a78bfa") : "rgba(255,255,255,.18)" }}>
                  {isNext && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-violet-200 whitespace-nowrap">next</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {DAY_SHORT.map((d, i) => (
              <span key={i} className={`flex-1 text-center text-[11px] ${sched.days.includes(i) ? "text-white font-semibold" : "text-white/40"}`}>{d}</span>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/50 mt-3">
          We visit {sched.days.length > 1 ? "on " : "every "}<span className="text-white/80 font-medium">{sched.label}</span>
          {customer.oneTimeClient ? " (one-time)" : ` · ${frequencyLabel(customer.cleanupFrequency).toLowerCase()}`}.
        </p>
      </div>
    </>
  );
}
