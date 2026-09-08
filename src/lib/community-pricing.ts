// Community-quote pricing: pure functions and the field record, shared by the
// calculator (client), the pipeline board, and server pages. No React here.

export type Condition = "easy" | "standard";
export type Frequency = "twice" | "weekly" | "biweekly" | "monthly";

export type Fields = {
  property: string;
  units: string;
  acres: string;            // always stored in acres; areaUnit only changes how it's shown/typed
  areaUnit: "acres" | "sqft";
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

export const DEFAULTS: Fields = {
  property: "",
  units: "120",
  acres: "2",
  areaUnit: "acres",
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

export const PROVIDER_ENTITY = "DooGoodScoopers";
export const PROVIDER_PHONE = "(909) 366-3744";
export const WEEKS_PER_MONTH = 4.3333;

export const FREQUENCIES: { value: Frequency; label: string; visitsMo: number }[] = [
  { value: "twice", label: "Twice a week", visitsMo: 2 * WEEKS_PER_MONTH },
  { value: "weekly", label: "Weekly", visitsMo: WEEKS_PER_MONTH },
  { value: "biweekly", label: "Every other week", visitsMo: WEEKS_PER_MONTH / 2 },
  { value: "monthly", label: "Once a month", visitsMo: 1 },
];

export const num = (s: string) => {
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : 0;
};
export const money0 = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";
export const money2 = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

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


/** Monthly figure from a saved quote's field record (as stored on a commercial lead), or null. */
export function quotedMonthlyFrom(fields: unknown): number | null {
  if (!fields || typeof fields !== "object") return null;
  try {
    const m = price({ ...DEFAULTS, ...(fields as Partial<Fields>) }).monthlyTotal;
    return isFinite(m) && m > 0 ? m : null;
  } catch { return null; }
}
