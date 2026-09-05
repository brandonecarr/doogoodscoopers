"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Info, FileDown, Loader2, Ruler, ChevronDown } from "lucide-react";
import type { ContractData } from "@/components/admin/CommunityContractDocument";
import { AreaMeasureMap } from "@/components/admin/AreaMeasureMap";

// Community / HOA quote calculator. The price is BUILT from serviceable area ×
// frequency × a loaded hourly rate (with a per-visit floor), then PRESENTED as a
// per-unit figure — the number an HOA board actually budgets against.

export type Fields = {
  property: string;
  units: string;
  acres: string;
  minutesPerAcre: string;
  driveMinutes: string;
  loadedRate: string;
  visitMinimum: string;
  freqPerWeek: string;
  dogPct: string;
  dogsPerHome: string;
  stations: string;
  stationMonthly: string;
  stationInstall: string;
  initialCleanup: string;
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
  minutesPerAcre: "45",
  driveMinutes: "20",
  loadedRate: "65",
  visitMinimum: "45",
  freqPerWeek: "2",
  dogPct: "30",
  dogsPerHome: "1.2",
  stations: "0",
  stationMonthly: "50",
  stationInstall: "125",
  initialCleanup: "0",
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

  const c = useMemo(() => {
    const units = num(f.units);
    const acres = num(f.acres);
    const onSiteMin = acres * num(f.minutesPerAcre);
    const laborMin = onSiteMin + num(f.driveMinutes);
    const laborCost = (laborMin / 60) * num(f.loadedRate);
    const perVisit = Math.max(laborCost, num(f.visitMinimum));
    const belowFloor = laborCost > 0 && laborCost < num(f.visitMinimum);
    const freq = num(f.freqPerWeek);
    const visitsMo = freq * 4.33;
    const monthlyCommon = perVisit * visitsMo;
    const stations = num(f.stations);
    const monthlyStations = stations * num(f.stationMonthly);
    const monthlyTotal = monthlyCommon + monthlyStations;
    const perUnitMo = units > 0 ? monthlyTotal / units : NaN;
    const perUnitYr = perUnitMo * 12;
    const installTotal = stations * num(f.stationInstall);
    const oneTime = num(f.initialCleanup) + installTotal;
    const estDogs = Math.round(units * (num(f.dogPct) / 100) * num(f.dogsPerHome));

    const tiers = [1, 2, 3].map((fq) => {
      const mTotal = perVisit * fq * 4.33 + monthlyStations;
      return { fq, mTotal, perUnit: units > 0 ? mTotal / units : NaN };
    });

    return {
      units, acres, onSiteMin, perVisit, belowFloor, freq, visitsMo,
      monthlyCommon, stations, monthlyStations, monthlyTotal,
      perUnitMo, perUnitYr, installTotal, oneTime, estDogs, tiers,
    };
  }, [f]);

  // What the currently-traced area would do to the quote, at today's settings.
  const measuredImpact = useMemo(() => {
    if (measured <= 0) return null;
    const onSite = measured * num(f.minutesPerAcre);
    const labor = ((onSite + num(f.driveMinutes)) / 60) * num(f.loadedRate);
    const perVisit = Math.max(labor, num(f.visitMinimum));
    const monthly = perVisit * num(f.freqPerWeek) * 4.33 + num(f.stations) * num(f.stationMonthly);
    const units = num(f.units);
    return { onSite, perVisit, monthly, perUnit: units > 0 ? monthly / units : NaN, floored: labor > 0 && labor < num(f.visitMinimum) };
  }, [measured, f]);

  const proposal = useMemo(() => {
    const name = f.property.trim() || "Your Community";
    const L: string[] = [];
    L.push(`${name} — Dog Waste Removal Proposal`);
    L.push("");
    L.push(`Service: Common-area pet-waste removal${c.stations > 0 ? " + pet-station servicing" : ""}`);
    L.push(`Frequency: ${c.freq}× per week (${c.visitsMo.toFixed(1)} visits/month)`);
    L.push(`Serviceable area: ${c.acres} acre${c.acres === 1 ? "" : "s"} · ${c.units} units`);
    L.push("");
    L.push(`MONTHLY INVESTMENT: ${money0(c.monthlyTotal)}`);
    L.push(`  • Common-area service: ${money0(c.monthlyCommon)}`);
    if (c.stations > 0) L.push(`  • Pet-station service (${c.stations}): ${money0(c.monthlyStations)}`);
    if (isFinite(c.perUnitMo)) {
      L.push("");
      L.push(`That's just ${money2(c.perUnitMo)} per home each month — about ${money0(c.perUnitYr)} per home per year —`);
      L.push(`to keep every shared space clean, safe, and odor-free for residents, kids, and pets.`);
    }
    if (c.oneTime > 0) {
      L.push("");
      L.push(`ONE-TIME START-UP: ${money0(c.oneTime)}`);
      if (num(f.initialCleanup) > 0) L.push(`  • Initial deep cleanup: ${money0(num(f.initialCleanup))}`);
      if (c.installTotal > 0) L.push(`  • Station installation (${c.stations}): ${money0(c.installTotal)}`);
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
    freq: c.freq,
    visitsMo: c.visitsMo.toFixed(1),
    stations: c.stations,
    monthlyTotal: money0(c.monthlyTotal),
    perUnitMo: money2(c.perUnitMo),
    oneTime: money0(c.oneTime),
    hasOneTime: c.oneTime > 0,
  }), [f, c]);

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
            <Num label="Number of units / homes" value={f.units} onChange={(v) => set("units", v)} suffix="units" />
            <Num label="Serviceable common area" value={f.acres} onChange={(v) => set("acres", v)} suffix="acres" step="0.1" hint="Only the areas dogs use — trace it on the map below." />
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
                onApply={(acres, place) => {
                  set("acres", String(acres));
                  // Offer the searched place as the property name if none typed yet.
                  if (place && !f.property.trim()) set("property", place.split(",")[0]);
                  // Collapse back to the form so the updated acres field is in view.
                  setMeasuring(false);
                }}
                impact={
                  measuredImpact && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">What this area prices at</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gray-600">
                        <span><b className="text-navy-900">{measured.toFixed(2)}</b> ac</span>
                        <span className="text-gray-300">×</span>
                        <span>{f.minutesPerAcre} min/ac</span>
                        <span className="text-gray-300">=</span>
                        <span><b className="text-navy-900">{Math.round(measuredImpact.onSite)}</b> min on site</span>
                        <span className="text-gray-300">→</span>
                        <span><b className="text-navy-900">${measuredImpact.perVisit.toFixed(2)}</b>/visit</span>
                        <span className="text-gray-300">→</span>
                        <span><b className="text-green-700">${Math.round(measuredImpact.monthly).toLocaleString()}</b>/mo</span>
                        {Number.isFinite(measuredImpact.perUnit) && (
                          <>
                            <span className="text-gray-300">→</span>
                            <span><b className="text-navy-900">${measuredImpact.perUnit.toFixed(2)}</b>/unit/mo</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11.5px] text-gray-500 mt-1.5">
                        {measuredImpact.floored
                          ? "Below your per-visit minimum, so the floor price applies."
                          : "Tune sweep time per acre, drive time and rate under Service & pricing."}
                      </p>
                    </div>
                  )
                }
              />
            </div>
          )}
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Service &amp; pricing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Visit frequency</span>
              <select value={f.freqPerWeek} onChange={(e) => set("freqPerWeek", e.target.value)} className={inputCls}>
                <option value="1">1× per week</option>
                <option value="2">2× per week</option>
                <option value="3">3× per week</option>
                <option value="5">5× per week</option>
                <option value="7">Daily (7×)</option>
              </select>
            </label>
            <Num label="Your loaded hourly rate" value={f.loadedRate} onChange={(v) => set("loadedRate", v)} prefix="$" suffix="/hr" hint="All-in: wages, fuel, disposal, insurance, profit." />
            <Num label="Sweep time per acre" value={f.minutesPerAcre} onChange={(v) => set("minutesPerAcre", v)} suffix="min" hint="Raise it for heavy dog traffic / dense landscaping." />
            <Num label="Drive time (round trip)" value={f.driveMinutes} onChange={(v) => set("driveMinutes", v)} suffix="min" />
            <Num label="Per-visit minimum" value={f.visitMinimum} onChange={(v) => set("visitMinimum", v)} prefix="$" hint="Price floor — you drive out regardless." />
          </div>
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-1">Dog load <span className="font-medium text-muted">(optional — helps you judge sweep time)</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <Num label="Homes with a dog" value={f.dogPct} onChange={(v) => set("dogPct", v)} suffix="%" />
            <Num label="Avg dogs per dog-home" value={f.dogsPerHome} onChange={(v) => set("dogsPerHome", v)} step="0.1" />
          </div>
          <p className="text-[12px] text-bodytext mt-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-violet-500" />
            Estimated dogs in the community: <b className="text-ink">{c.estDogs.toLocaleString()}</b>
          </p>
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Add-ons &amp; start-up</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Num label="Pet-waste stations serviced" value={f.stations} onChange={(v) => set("stations", v)} suffix="stations" />
            <Num label="Per station / month" value={f.stationMonthly} onChange={(v) => set("stationMonthly", v)} prefix="$" hint="Restock bags + empty bin." />
            <Num label="Station install (one-time, each)" value={f.stationInstall} onChange={(v) => set("stationInstall", v)} prefix="$" />
            <Num label="Initial deep cleanup (one-time)" value={f.initialCleanup} onChange={(v) => set("initialCleanup", v)} prefix="$" hint="For neglected grounds — charge separately." />
          </div>
        </div>

        <details className="dgs-card p-4" open>
          <summary className="text-[13px] font-bold text-ink cursor-pointer select-none">Contract details <span className="font-medium text-muted">(for the PDF agreement)</span></summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Client legal name (HOA / association)</span>
              <input value={f.clientLegalName} onChange={(e) => set("clientLegalName", e.target.value)} placeholder={f.property || "e.g. Riverside Condominiums HOA"} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[12px] font-semibold text-bodytext mb-1">Property address</span>
              <input value={f.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="123 Main St, Fontana, CA 92335" className={inputCls} />
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
            {c.freq}×/week · {c.visitsMo.toFixed(1)} visits/mo · {money0(c.perVisit)}/visit · {money0(c.perUnitYr)}/unit/yr
          </p>
        </div>

        <div className="dgs-card p-4">
          <h3 className="text-[13px] font-bold text-ink mb-3">Breakdown</h3>
          <dl className="space-y-2 text-[13px]">
            <Row k={`Common-area service (${c.visitsMo.toFixed(1)} visits)`} v={money0(c.monthlyCommon)} />
            {c.stations > 0 && <Row k={`Pet-station service (${c.stations})`} v={money0(c.monthlyStations)} />}
            <div className="border-t border-hairline my-1" />
            <Row k="Monthly total" v={money0(c.monthlyTotal)} bold />
            <Row k="Per unit / month" v={money2(c.perUnitMo)} accent />
            <Row k="Per unit / year" v={money0(c.perUnitYr)} />
            {c.oneTime > 0 && (
              <>
                <div className="border-t border-hairline my-1" />
                <Row k="One-time start-up" v={money0(c.oneTime)} bold />
                {num(f.initialCleanup) > 0 && <Row k="— Initial cleanup" v={money0(num(f.initialCleanup))} sub />}
                {c.installTotal > 0 && <Row k={`— Station install (${c.stations})`} v={money0(c.installTotal)} sub />}
              </>
            )}
          </dl>
          {c.belowFloor && (
            <p className="text-[11.5px] text-[#8A6D00] bg-[#FEF6E7] rounded-lg px-2.5 py-1.5 mt-3">
              Labor for this visit is under your ${num(f.visitMinimum)} minimum — the floor is being applied.
            </p>
          )}
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
              {c.tiers.map((t) => (
                <tr key={t.fq} className={t.fq === c.freq ? "font-bold text-ink" : "text-bodytext"}>
                  <td className="py-1">{t.fq}×/week{t.fq === c.freq ? " ←" : ""}</td>
                  <td className="py-1 text-right">{money0(t.mTotal)}</td>
                  <td className="py-1 text-right">{money2(t.perUnit)}</td>
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
                onClick={exportPdf}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: "#6D3EF0" }}
                title="Download the full service agreement as a PDF"
              >
                {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {pdfBusy ? "Generating…" : "Export PDF"}
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
            <b>Copy</b> grabs the short proposal above. <b>Export PDF</b> downloads the full service agreement — fill in the Contract details for a signature-ready document.
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
