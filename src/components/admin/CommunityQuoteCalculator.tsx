"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, FileDown, FileText, Loader2, Ruler, ChevronDown } from "lucide-react";
import type { ContractData } from "@/components/admin/CommunityContractDocument";
import type { ProposalData, ProposalPlan, ProposalLine } from "@/components/admin/CommunityProposalDocument";
import { AreaMeasureMap } from "@/components/admin/AreaMeasureMap";

// Community / HOA quote calculator — a rate card, not a cost model.
//
// Price = serviceable acres × a per-acre-per-visit rate (Easy Clean or Standard)
// + pet stations × a per-station-per-visit rate (volume-tiered), × 4.33 for a
// weekly month. Less frequent service is NOT proportionally cheaper: every-other-
// week is 75% of weekly and monthly is 75% of that, because each visit carries
// more waste. Station service, hardware and installation carry sales tax.
// The result is still presented per unit — the number an HOA board budgets on.

export type Condition = "easy" | "standard";
export type Frequency = "twice" | "weekly" | "biweekly" | "monthly";

export type Fields = {
  property: string;
  units: string;
  acres: string;
  condition: Condition;
  frequency: Frequency;
  stations: string;
  initialCleanup: "yes" | "no";
  hwBag: string;
  hwRound: string;
  hwLocking: string;
  /** Traced service areas as JSON lng/lat rings — saved with the quote, drawn on the proposal map. */
  mapShapes: string;
  /** Placed pet-waste stations as JSON lng/lat points — drawn on the proposal map with a legend. */
  mapStations: string;
  // Rate card (defaults from the Swoop Scoop commercial calculator)
  rateEasy: string;
  rateStandard: string;
  rateOneTime: string;
  st1: string;
  st6: string;
  st11: string;
  st15: string;
  st20: string;
  biweeklyPct: string;
  monthlyPct: string;
  hwBagPrice: string;
  hwRoundPrice: string;
  hwLockingPrice: string;
  installEach: string;
  taxPct: string;
  // Contract details (for the PDF)
  clientLegalName: string;
  propertyAddress: string;
  clientContact: string;
  clientEmail: string;
  effectiveDate: string;
  termMonths: string;
  netDays: string;
  lateFeePct: string;
  governingState: string;
  providerAddress: string;
  providerEmail: string;
};

const DEFAULTS: Fields = {
  property: "",
  units: "120",
  acres: "2",
  condition: "standard",
  frequency: "weekly",
  stations: "0",
  initialCleanup: "no",
  hwBag: "0",
  hwRound: "0",
  hwLocking: "0",
  mapShapes: "[]",
  mapStations: "[]",
  rateEasy: "85",
  rateStandard: "135",
  rateOneTime: "380",
  st1: "17.95",
  st6: "17.45",
  st11: "16.95",
  st15: "16.45",
  st20: "15.95",
  biweeklyPct: "75",
  monthlyPct: "75",
  hwBagPrice: "199",
  hwRoundPrice: "299",
  hwLockingPrice: "499",
  installEach: "85",
  taxPct: "9",
  clientLegalName: "",
  propertyAddress: "",
  clientContact: "",
  clientEmail: "",
  effectiveDate: "",
  termMonths: "12",
  netDays: "15",
  lateFeePct: "1.5",
  governingState: "California",
  providerAddress: "",
  providerEmail: "",
};

const PROVIDER_ENTITY = "DooGoodScoopers";
const PROVIDER_PHONE = "(909) 366-3744";
const WEEKS_PER_MONTH = 4.3333;

export const FREQUENCIES: { value: Frequency; label: string; visitsMo: number }[] = [
  { value: "twice", label: "Twice a week", visitsMo: 2 * WEEKS_PER_MONTH },
  { value: "weekly", label: "Weekly", visitsMo: WEEKS_PER_MONTH },
  { value: "biweekly", label: "Every other week", visitsMo: WEEKS_PER_MONTH / 2 },
  { value: "monthly", label: "Once a month", visitsMo: 1 },
];

const num = (s: string) => {
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : 0;
};
const money0 = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";
const money2 = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white text-ink";

/** Per-station per-visit rate for a station count (volume tiers). */
function stationRate(count: number, f: Fields): number {
  if (count <= 0) return 0;
  if (count <= 5) return num(f.st1);
  if (count <= 10) return num(f.st6);
  if (count <= 14) return num(f.st11);
  if (count <= 19) return num(f.st15);
  return num(f.st20);
}

/** Multiplier applied to the weekly monthly figure for a frequency. */
function freqFactor(freq: Frequency, f: Fields): number {
  const bi = num(f.biweeklyPct) / 100 || 0.75;
  const mo = num(f.monthlyPct) / 100 || 0.75;
  switch (freq) {
    case "twice": return 2;
    case "weekly": return 1;
    case "biweekly": return bi;
    case "monthly": return bi * mo;
  }
}

/** Everything the quote needs, from the fields. Pure, so the map preview can reuse it. */
export function price(f: Fields, acresOverride?: number, freqOverride?: Frequency) {
  const units = num(f.units);
  const acres = acresOverride ?? num(f.acres);
  const ratePerAcre = f.condition === "easy" ? num(f.rateEasy) : num(f.rateStandard);
  const areaPerVisit = acres * ratePerAcre;
  const stations = Math.round(num(f.stations));
  const stRate = stationRate(stations, f);
  const stationsPerVisit = stations * stRate;
  const tax = num(f.taxPct) / 100;
  // Weekly month, then scale by frequency (their model scales the whole total).
  const weeklyArea = areaPerVisit * WEEKS_PER_MONTH;
  const weeklyStations = stationsPerVisit * WEEKS_PER_MONTH;
  const weeklyStationTax = weeklyStations * tax;
  const weeklyTotal = weeklyArea + weeklyStations + weeklyStationTax;
  const frequency = freqOverride ?? f.frequency;
  const factor = freqFactor(frequency, f);
  const monthlyArea = weeklyArea * factor;
  const monthlyStations = weeklyStations * factor;
  const monthlyStationTax = weeklyStationTax * factor;
  const monthlyTotal = weeklyTotal * factor;
  const visitsMo = FREQUENCIES.find((x) => x.value === frequency)!.visitsMo;
  const perVisit = visitsMo > 0 ? monthlyTotal / visitsMo : 0;
  const perUnitMo = units > 0 ? monthlyTotal / units : NaN;
  const perUnitYr = perUnitMo * 12;
  // One-time
  const cleanup = f.initialCleanup === "yes" ? acres * num(f.rateOneTime) : 0;
  const hwCount = Math.round(num(f.hwBag)) + Math.round(num(f.hwRound)) + Math.round(num(f.hwLocking));
  const hardware = Math.round(num(f.hwBag)) * num(f.hwBagPrice) + Math.round(num(f.hwRound)) * num(f.hwRoundPrice) + Math.round(num(f.hwLocking)) * num(f.hwLockingPrice);
  const install = hwCount * num(f.installEach);
  const oneTimeTax = (hardware + install) * tax;
  const oneTime = cleanup + hardware + install + oneTimeTax;
  const plans = FREQUENCIES.map((p) => {
    const mTotal = weeklyTotal * freqFactor(p.value, f);
    return { ...p, mTotal, perUnit: units > 0 ? mTotal / units : NaN };
  });
  return {
    units, acres, ratePerAcre, areaPerVisit, stations, stRate, stationsPerVisit, visitsMo, perVisit,
    monthlyArea, monthlyStations, monthlyStationTax, monthlyTotal, perUnitMo, perUnitYr,
    cleanup, hwCount, hardware, install, oneTimeTax, oneTime, plans,
    frequencyLabel: FREQUENCIES.find((x) => x.value === frequency)!.label,
    frequency, factor, weeklyArea, weeklyStations, weeklyStationTax, tax,
  };
}

/** Proposal page 7. Mirrors the service agreement's terms in plain language. */
export const PROPOSAL_TERMS: { heading: string; items: string[] }[] = [
  { heading: "Common Area Cleaning", items: [
    "Service covers common areas and designated pet-relief areas only. Private patios, yards, balconies and interior spaces are not included unless agreed in writing.",
    "Does not include micro debris (cigarettes, needles, glass, etc.), large items (bigger than a scoop bucket), or hazmat materials.",
    "Pet waste covered by leaves, mulch or yard debris may not be fully recoverable.",
    "Visits are made during daylight hours. Service days may shift for weather, holidays or routing, with reasonable notice.",
  ] },
  { heading: "Station Service", items: [
    "DooGoodScoopers will need keys or codes to locked pet-waste stations before servicing.",
    "If station installation is delayed by weather or supply issues, the station's area is cleaned at the same cost until it arrives.",
    "Final station locations must be approved in writing. Locations are subject to change.",
  ] },
  { heading: "Billing", items: [
    "One-time fees (initial cleanup, stations, installation) are due on acceptance of this proposal.",
    "Recurring service is billed monthly in advance on the 1st. Auto-Pay by card or bank account on file is required.",
    "Services performed during the first partial month are added to the first invoice.",
    "A failed payment must be cured within 15 days; balances past that accrue a 1.5% monthly late charge and service may pause until paid.",
    "Prices shown include applicable sales tax. A 5% discount applies to annual service paid in full up front.",
  ] },
  { heading: "Term & Notices", items: [
    "Service begins on the effective date and renews month to month until cancelled in writing by either party with 30 days' notice.",
    "The current month is non-refundable; service continues through the end of the paid month.",
    "DooGoodScoopers gives at least 30 days' written notice of any price change.",
  ] },
  { heading: "Extra Visits", items: [
    "Additional visits for vandalized stations, overflowing cans or excess waste are available on request and added to the next invoice.",
  ] },
  { heading: "Insurance & Care", items: [
    "DooGoodScoopers is licensed, bonded and insured. A certificate of insurance is available on request.",
    "Please keep dogs restrained during visits and let us know about gate codes, locked areas or hazards.",
  ] },
];

const SERVICES_PER_YEAR: Record<Frequency, number> = { twice: 104, weekly: 52, biweekly: 26, monthly: 12 };
const sqft = (acres: number) => Math.round(acres * 43560).toLocaleString("en-US");

/** One itemization page for a frequency, in the template's table shape. */
function proposalPlan(f: Fields, freq: Frequency): ProposalPlan {
  const c = price(f, undefined, freq);
  const n = SERVICES_PER_YEAR[freq];
  const label = FREQUENCIES.find((x) => x.value === freq)!.label;
  const cadence = freq === "twice" ? "Twice-Weekly" : freq === "weekly" ? "Weekly" : freq === "biweekly" ? "Bi-Weekly" : "Monthly";
  const lines: ProposalLine[] = [];
  const hw: [string, string, string][] = [[f.hwBag, "Dog Waste Stations (Bag Only)", f.hwBagPrice], [f.hwRound, "Dog Waste Stations (Bag + Can)", f.hwRoundPrice], [f.hwLocking, "Dog Waste Stations (Locking Can)", f.hwLockingPrice]];
  for (const [q, desc, unit] of hw) {
    const qty = Math.round(num(q)); if (qty <= 0) continue;
    lines.push({ qty: String(qty), desc, unit: money2(num(unit)), services: "1", amount: `${money2(qty * num(unit) * (1 + c.tax))} (one time fee)` });
  }
  if (c.hwCount > 0) lines.push({ qty: String(c.hwCount), desc: "Station Installation", unit: money2(num(f.installEach)), services: "1", amount: `${money2(c.install * (1 + c.tax))} (one time fee)` });
  if (c.cleanup > 0) lines.push({ qty: "1", desc: `Initial Cleanup of Property · Approx. ${sqft(c.acres)} Sq Ft.`, unit: money2(c.cleanup), services: "1", amount: `${money2(c.cleanup)} (one time fee)` });
  if (c.stations > 0) {
    // Unit price is per station per visit (the rate card figure at this plan's frequency).
    const unit = (c.monthlyStations * 12) / n / c.stations;
    lines.push({ qty: String(c.stations), desc: `${cadence} Station Service, Bag Replacement & Waste Disposal`, unit: money2(unit), services: String(n), amount: `${money2(c.monthlyStations + c.monthlyStationTax)}/month` });
  }
  lines.push({ qty: "1", desc: `${cadence} Common Area Cleaning · Approx. ${sqft(c.acres)} Sq Ft.`, unit: money2((c.monthlyArea * 12) / n), services: String(n), amount: `${money2(c.monthlyArea)}/month` });
  const oneTime: { label: string; amount: string }[] = [];
  if (c.cleanup > 0) oneTime.push({ label: "Initial Cleanup", amount: money2(c.cleanup) });
  if (c.hardware > 0) oneTime.push({ label: "Dog Waste Stations", amount: money2(c.hardware * (1 + c.tax)) });
  if (c.install > 0) oneTime.push({ label: "Station Installation", amount: money2(c.install * (1 + c.tax)) });
  return { title: `${label} Service`, frequencyLabel: label, visitsMo: c.visitsMo.toFixed(1), selected: freq === f.frequency, lines, annualTotal: money2(c.monthlyTotal * 12), monthlyTotal: money2(c.monthlyTotal), oneTime, oneTimeTotal: money2(c.oneTime) };
}

/** The selected plan plus the natural alternative, as the template shows two options. */
function proposalPlans(f: Fields): ProposalPlan[] {
  const alt: Record<Frequency, Frequency> = { twice: "weekly", weekly: "biweekly", biweekly: "weekly", monthly: "biweekly" };
  return [proposalPlan(f, f.frequency), proposalPlan(f, alt[f.frequency])];
}

function Num({
  label, value, onChange, prefix, suffix, hint, step = "1",
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; hint?: string; step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-bodytext mb-1">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{prefix}</span>}
        <input
          type="number" inputMode="decimal" step={step} min="0" value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>}
      </div>
      {hint && <span className="block text-[11px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function CommunityQuoteCalculator({
  mapboxToken, initial, onChange,
}: {
  mapboxToken?: string;
  /** Prefill (e.g. a saved quote on a commercial lead). Missing keys fall back to defaults. */
  initial?: Partial<Fields>;
  /** Fires with the full field record on every change, so a host can save it. */
  onChange?: (fields: Fields) => void;
}) {
  const [f, setF] = useState<Fields>({ ...DEFAULTS, ...(initial || {}) });
  useEffect(() => { onChange?.(f); }, [f, onChange]);
  const [measuring, setMeasuring] = useState(false);
  const [measured, setMeasured] = useState(0); // live total from the map
  const set = (k: keyof Fields, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [copied, setCopied] = useState(false);

  const c = useMemo(() => price(f), [f]);
  // What the currently-traced area would price at, at today's settings.
  const measuredImpact = useMemo(() => (measured > 0 ? price(f, measured) : null), [measured, f]);

  const proposal = useMemo(() => {
    const name = f.property.trim() || "Your Community";
    const L: string[] = [];
    L.push(`${name} — Dog Waste Removal Proposal`);
    L.push("");
    L.push(`Service: Common-area pet-waste removal${c.stations > 0 ? " + pet-station servicing" : ""}`);
    L.push(`Frequency: ${c.frequencyLabel} (${c.visitsMo.toFixed(1)} visits/month)`);
    L.push(`Serviceable area: ${c.acres} acre${c.acres === 1 ? "" : "s"} · ${c.units} units`);
    L.push("");
    L.push(`MONTHLY INVESTMENT: ${money0(c.monthlyTotal)}`);
    L.push(`  • Common-area service: ${money0(c.monthlyArea)}`);
    if (c.stations > 0) L.push(`  • Pet-station service (${c.stations}): ${money0(c.monthlyStations + c.monthlyStationTax)}${c.monthlyStationTax > 0 ? " incl. tax" : ""}`);
    if (isFinite(c.perUnitMo)) {
      L.push("");
      L.push(`That's just ${money2(c.perUnitMo)} per home each month — about ${money0(c.perUnitYr)} per home per year —`);
      L.push(`to keep every shared space clean, safe, and odor-free for residents, kids, and pets.`);
    }
    if (c.oneTime > 0) {
      L.push("");
      L.push(`ONE-TIME START-UP: ${money0(c.oneTime)}`);
      if (c.cleanup > 0) L.push(`  • Initial deep cleanup (${c.acres} ac): ${money0(c.cleanup)}`);
      if (c.hardware > 0) L.push(`  • Pet-waste stations (${c.hwCount}): ${money0(c.hardware)}`);
      if (c.install > 0) L.push(`  • Installation (${c.hwCount}): ${money0(c.install)}`);
      if (c.oneTimeTax > 0) L.push(`  • Sales tax: ${money0(c.oneTimeTax)}`);
    }
    L.push("");
    L.push(`Includes all labor, bags, waste disposal, and full liability insurance.`);
    return L.join("\n");
  }, [f, c]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(proposal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* still selectable on screen */ }
  };

  const contractData: ContractData = useMemo(() => ({
    providerEntity: PROVIDER_ENTITY,
    providerAddress: f.providerAddress,
    providerPhone: PROVIDER_PHONE,
    providerEmail: f.providerEmail,
    clientLegalName: f.clientLegalName || f.property,
    propertyAddress: f.propertyAddress,
    clientContact: f.clientContact,
    clientEmail: f.clientEmail,
    effectiveDate: f.effectiveDate,
    termMonths: f.termMonths,
    netDays: f.netDays,
    lateFeePct: f.lateFeePct,
    governingState: f.governingState,
    acres: f.acres,
    units: f.units,
    frequency: c.frequencyLabel.toLowerCase(),
    visitsMo: c.visitsMo.toFixed(1),
    stations: c.stations,
    monthlyTotal: money0(c.monthlyTotal),
    perUnitMo: money2(c.perUnitMo),
    oneTime: money0(c.oneTime),
    hasOneTime: c.oneTime > 0,
  }), [f, c]);

  const [proposalBusy, setProposalBusy] = useState(false);
  const exportProposal = async () => {
    setProposalBusy(true);
    try {
      let rings: unknown[] = []; let pins: unknown[] = [];
      try { rings = JSON.parse(f.mapShapes || "[]"); } catch { rings = []; }
      try { pins = JSON.parse(f.mapStations || "[]"); } catch { pins = []; }
      const origin = window.location.origin;
      const data: ProposalData = {
        baseUrl: origin,
        locationName: f.property.trim(),
        serviceAddress: f.propertyAddress.trim(),
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        mapUrl: rings.length || pins.length ? `${origin}/api/admin/proposal-map?shapes=${encodeURIComponent(JSON.stringify(rings))}&stations=${encodeURIComponent(JSON.stringify(pins))}&w=934&h=630` : null,
        stationPins: pins.length,
        sqftTotal: sqft(c.acres),
        stations: String(Math.max(c.stations, c.hwCount)),
        plans: proposalPlans(f),
        terms: PROPOSAL_TERMS,
      };
      const { downloadProposalPdf } = await import("@/components/admin/CommunityProposalDocument");
      await downloadProposalPdf(data);
    } catch (e) {
      console.error("[proposal pdf]", e);
    } finally {
      setProposalBusy(false);
    }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadContractPdf } = await import("@/components/admin/CommunityContractDocument");
      await downloadContractPdf(contractData);
    } catch {
      /* generation failed — leave the UI unchanged */
    } finally {
      setPdfBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-lg border text-[13px] font-semibold text-center transition-colors ${active ? "border-violet-500 bg-violet-50 text-violet-800" : "border-gray-200 text-gray-700 hover:border-gray-300"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,420px)] gap-3.5">
      {/* ── Inputs ─────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Community</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Community / property name</span>
              <input value={f.property} onChange={(e) => set("property", e.target.value)} placeholder="e.g. Riverside Condominiums" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Service address</span>
              <input value={f.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="123 Main St, Fontana, CA 92335" className={inputCls} />
            </label>
            <Num label="Number of units / homes" value={f.units} onChange={(v) => set("units", v)} suffix="units" />
            <Num label="Serviceable common area" value={f.acres} onChange={(v) => set("acres", v)} suffix="acres" step="0.01" hint="Only the areas dogs use — trace it on the map below." />
          </div>

          {/* Satellite measuring: turns "guess the acreage" into tracing the lawns. */}
          <button
            type="button"
            onClick={() => setMeasuring((v) => !v)}
            className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-dashed transition-colors"
            style={{ borderColor: measuring ? "#6D3EF0" : "#D1D5DB", background: measuring ? "#F5F2FF" : "transparent" }}
          >
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: measuring ? "#6D3EF0" : "#374151" }}>
              <Ruler className="w-4 h-4" />
              Measure the area from satellite
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${measuring ? "rotate-180" : ""}`} style={{ color: measuring ? "#6D3EF0" : "#9CA3AF" }} />
          </button>

          {measuring && (
            <div className="mt-3">
              <AreaMeasureMap
                token={mapboxToken}
                onTotalChange={setMeasured}
                onShapesChange={(rings) => set("mapShapes", JSON.stringify(rings))}
                initialShapes={(() => { try { return JSON.parse(f.mapShapes || "[]"); } catch { return []; } })()}
                // Placed stations are the source of truth for the serviced count once any are on the map.
                onStationsChange={(pts) => setF((p) => ({ ...p, mapStations: JSON.stringify(pts), stations: pts.length > 0 ? String(pts.length) : p.stations }))}
                initialStations={(() => { try { return JSON.parse(f.mapStations || "[]"); } catch { return []; } })()}
                onApply={(acres, place) => {
                  set("acres", String(acres));
                  if (place && !f.property.trim()) set("property", place.split(",")[0]);
                  setMeasuring(false);
                }}
                impact={
                  measuredImpact && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">What this area prices at</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gray-600">
                        <span><b className="text-navy-900">{measured.toFixed(2)}</b> ac</span>
                        <span className="text-gray-300">×</span>
                        <span>${measuredImpact.ratePerAcre}/ac</span>
                        <span className="text-gray-300">=</span>
                        <span><b className="text-navy-900">${measuredImpact.areaPerVisit.toFixed(0)}</b>/visit</span>
                        <span className="text-gray-300">→</span>
                        <span><b className="text-green-700">${Math.round(measuredImpact.monthlyTotal).toLocaleString()}</b>/mo {c.frequencyLabel.toLowerCase()}</span>
                        {Number.isFinite(measuredImpact.perUnitMo) && (
                          <>
                            <span className="text-gray-300">→</span>
                            <span><b className="text-navy-900">${measuredImpact.perUnitMo.toFixed(2)}</b>/unit/mo</span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                }
              />
            </div>
          )}
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Service</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Grounds condition</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => set("condition", "easy")} className={chip(f.condition === "easy")}>Easy clean<span className="block text-[11px] font-normal text-muted">little waste · ${num(f.rateEasy)}/ac</span></button>
                <button type="button" onClick={() => set("condition", "standard")} className={chip(f.condition === "standard")}>Standard<span className="block text-[11px] font-normal text-muted">${num(f.rateStandard)}/ac</span></button>
              </div>
            </div>
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Visit frequency</span>
              <select value={f.frequency} onChange={(e) => set("frequency", e.target.value)} className={inputCls}>
                {FREQUENCIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span className="block text-[11px] text-muted mt-1">Less often isn&apos;t proportionally cheaper: each visit carries more waste.</span>
            </label>
            <Num label="Pet-waste stations serviced" value={f.stations} onChange={(v) => set("stations", v)} suffix="stations" hint={c.stations > 0 ? `${money2(c.stRate)} per station per visit at this count` : "Restock bags + empty bin, each visit."} />
          </div>
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">One-time start-up <span className="font-medium text-muted">(optional)</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Initial deep cleanup</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => set("initialCleanup", "no")} className={chip(f.initialCleanup === "no")}>Not needed</button>
                <button type="button" onClick={() => set("initialCleanup", "yes")} className={chip(f.initialCleanup === "yes")}>Yes<span className="block text-[11px] font-normal text-muted">${num(f.rateOneTime)}/ac · {money0(num(f.acres) * num(f.rateOneTime))}</span></button>
              </div>
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Num label={`Bag-only stations ($${num(f.hwBagPrice)})`} value={f.hwBag} onChange={(v) => set("hwBag", v)} />
              <Num label={`Round-can stations ($${num(f.hwRoundPrice)})`} value={f.hwRound} onChange={(v) => set("hwRound", v)} />
              <Num label={`Locking-can stations ($${num(f.hwLockingPrice)})`} value={f.hwLocking} onChange={(v) => set("hwLocking", v)} />
            </div>
            <p className="sm:col-span-2 text-[11px] text-muted">Installed stations are sold once, plus ${num(f.installEach)} installation each and {num(f.taxPct)}% sales tax. Add them to the serviced count above to bill monthly service on them.</p>
          </div>
        </div>

        <details className="dgs-card p-4">
          <summary className="text-[13px] font-bold text-ink cursor-pointer select-none">Rate card <span className="font-medium text-muted">(edit to change your pricing)</span></summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <Num label="Easy clean, per acre / visit" value={f.rateEasy} onChange={(v) => set("rateEasy", v)} prefix="$" />
            <Num label="Standard, per acre / visit" value={f.rateStandard} onChange={(v) => set("rateStandard", v)} prefix="$" />
            <Num label="One-time cleanup, per acre" value={f.rateOneTime} onChange={(v) => set("rateOneTime", v)} prefix="$" />
            <Num label="Every-other-week, % of weekly" value={f.biweeklyPct} onChange={(v) => set("biweeklyPct", v)} suffix="%" />
            <Num label="Monthly, % of every-other-week" value={f.monthlyPct} onChange={(v) => set("monthlyPct", v)} suffix="%" />
            <Num label="Sales tax (stations, hardware)" value={f.taxPct} onChange={(v) => set("taxPct", v)} suffix="%" step="0.25" />
          </div>
          <p className="text-[12px] font-semibold text-bodytext mt-4 mb-2">Station service, per station per visit</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Num label="1–5" value={f.st1} onChange={(v) => set("st1", v)} prefix="$" step="0.05" />
            <Num label="6–10" value={f.st6} onChange={(v) => set("st6", v)} prefix="$" step="0.05" />
            <Num label="11–14" value={f.st11} onChange={(v) => set("st11", v)} prefix="$" step="0.05" />
            <Num label="15–19" value={f.st15} onChange={(v) => set("st15", v)} prefix="$" step="0.05" />
            <Num label="20+" value={f.st20} onChange={(v) => set("st20", v)} prefix="$" step="0.05" />
          </div>
          <p className="text-[12px] font-semibold text-bodytext mt-4 mb-2">Station hardware, each</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Num label="Bag-only" value={f.hwBagPrice} onChange={(v) => set("hwBagPrice", v)} prefix="$" />
            <Num label="Round can" value={f.hwRoundPrice} onChange={(v) => set("hwRoundPrice", v)} prefix="$" />
            <Num label="Locking can" value={f.hwLockingPrice} onChange={(v) => set("hwLockingPrice", v)} prefix="$" />
            <Num label="Installation" value={f.installEach} onChange={(v) => set("installEach", v)} prefix="$" />
          </div>
        </details>

        <details className="dgs-card p-4">
          <summary className="text-[13px] font-bold text-ink cursor-pointer select-none">Contract details <span className="font-medium text-muted">(for the PDF agreement)</span></summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Client legal name (HOA / association)</span>
              <input value={f.clientLegalName} onChange={(e) => set("clientLegalName", e.target.value)} placeholder={f.property || "e.g. Riverside Condominiums HOA"} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Client contact name</span>
              <input value={f.clientContact} onChange={(e) => set("clientContact", e.target.value)} placeholder="Property manager / board contact" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Client email</span>
              <input value={f.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="manager@example.com" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Effective date</span>
              <input type="date" value={f.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} className={inputCls} />
            </label>
            <Num label="Initial term (months)" value={f.termMonths} onChange={(v) => set("termMonths", v)} suffix="months" />
            <Num label="Payment due (net days)" value={f.netDays} onChange={(v) => set("netDays", v)} suffix="days" />
            <Num label="Late fee" value={f.lateFeePct} onChange={(v) => set("lateFeePct", v)} suffix="%/mo" step="0.1" />
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Governing state</span>
              <input value={f.governingState} onChange={(e) => set("governingState", e.target.value)} placeholder="California" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Provider email (for notices)</span>
              <input value={f.providerEmail} onChange={(e) => set("providerEmail", e.target.value)} placeholder="hello@doogoodscoopers.com" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Provider mailing address</span>
              <input value={f.providerAddress} onChange={(e) => set("providerAddress", e.target.value)} placeholder="DooGoodScoopers business address" className={inputCls} />
            </label>
          </div>
          <p className="text-[11px] text-muted mt-3">Blank fields print as a fill-in line. Have counsel review before use.</p>
        </details>
      </div>

      {/* ── Results ────────────────────────────────────────────── */}
      <div className="space-y-3.5 lg:sticky lg:top-[92px] self-start">
        <div className="dgs-hero p-[22px]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C8B9FF]">Monthly total</p>
              <p className="text-[30px] font-extrabold text-white tracking-[-0.02em] leading-tight mt-1">{money0(c.monthlyTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C8B9FF]">Per unit / month</p>
              <p className="text-[30px] font-extrabold text-white tracking-[-0.02em] leading-tight mt-1">{money2(c.perUnitMo)}</p>
            </div>
          </div>
          <p className="text-[12px] text-[#C9C9D6] mt-3">
            {c.frequencyLabel} · {c.visitsMo.toFixed(1)} visits/mo · {money0(c.perVisit)}/visit · {money0(c.perUnitYr)}/unit/yr
          </p>
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Breakdown</h3>
          <dl className="space-y-2 text-[13px]">
            <Row k={`Common area · ${c.acres} ac × $${c.ratePerAcre}/ac${f.condition === "easy" ? " (easy)" : ""}`} v={money0(c.monthlyArea)} />
            {c.stations > 0 && <Row k={`Stations · ${c.stations} × ${money2(c.stRate)}/visit`} v={money0(c.monthlyStations)} />}
            {c.monthlyStationTax > 0 && <Row k={`— Sales tax on station service (${num(f.taxPct)}%)`} v={money0(c.monthlyStationTax)} sub />}
            <div className="border-t border-hairline my-1" />
            <Row k="Monthly total" v={money0(c.monthlyTotal)} bold />
            <Row k="Per unit / month" v={money2(c.perUnitMo)} accent />
            <Row k="Per unit / year" v={money0(c.perUnitYr)} />
            {c.oneTime > 0 && (
              <>
                <div className="border-t border-hairline my-1" />
                <Row k="One-time start-up" v={money0(c.oneTime)} bold />
                {c.cleanup > 0 && <Row k={`— Initial cleanup (${c.acres} ac × $${num(f.rateOneTime)})`} v={money0(c.cleanup)} sub />}
                {c.hardware > 0 && <Row k={`— Stations (${c.hwCount})`} v={money0(c.hardware)} sub />}
                {c.install > 0 && <Row k={`— Installation (${c.hwCount} × $${num(f.installEach)})`} v={money0(c.install)} sub />}
                {c.oneTimeTax > 0 && <Row k={`— Sales tax (${num(f.taxPct)}%)`} v={money0(c.oneTimeTax)} sub />}
              </>
            )}
          </dl>
        </div>

        {/* Frequency comparison — give the board a tier to self-select */}
        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-2">Frequency options</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold pb-1">Plan</th>
                <th className="text-right font-semibold pb-1">Monthly</th>
                <th className="text-right font-semibold pb-1">Per unit</th>
              </tr>
            </thead>
            <tbody>
              {c.plans.map((p) => (
                <tr key={p.value} className={p.value === f.frequency ? "font-bold text-ink" : "text-bodytext"}>
                  <td className="py-1">{p.label}{p.value === f.frequency ? " ←" : ""}</td>
                  <td className="py-1 text-right">{money0(p.mTotal)}</td>
                  <td className="py-1 text-right">{money2(p.perUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Copy-ready proposal */}
        <div className="dgs-card p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-[13px] font-bold text-ink">Proposal</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={exportProposal}
                disabled={proposalBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: "#6D3EF0" }}
                title="Download the 8-page proposal deck as a PDF"
              >
                {proposalBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {proposalBusy ? "Generating…" : "Export PDF"}
              </button>
              <button
                onClick={exportPdf}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                title="Download the full service agreement as a PDF"
              >
                {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Agreement
              </button>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold text-white transition-colors"
                style={{ background: copied ? "#16A34A" : "#101014" }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <pre className="text-[11.5px] leading-relaxed text-bodytext whitespace-pre-wrap font-sans bg-surface2/60 rounded-lg p-3 max-h-[320px] overflow-auto">{proposal}</pre>
          <p className="text-[11px] text-muted mt-2">
            <b>Export PDF</b> downloads the 8-page proposal deck (cover, about, property map, two priced options, terms, approval). <b>Agreement</b> downloads the full service agreement — fill in the Contract details for a signature-ready document. <b>Copy</b> grabs the short text above.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold, accent, sub }: { k: string; v: string; bold?: boolean; accent?: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={`${sub ? "text-muted text-[12px]" : "text-bodytext"}`}>{k}</dt>
      <dd className={`tabular-nums ${accent ? "text-[15px] font-extrabold text-[#6D3EF0]" : bold ? "font-bold text-ink" : sub ? "text-muted text-[12px]" : "text-ink"}`}>{v}</dd>
    </div>
  );
}
