// The commercial proposal deck as a real PDF: eight 16:9 pages that follow the
// DooGoodScoopers-Proposal template page for page, filled from the Community
// Quote. Static pages (2, 3, 7) are fixed; the rest take the property, address,
// date, map, square footage, station count, and two priced service options.

import { Document, Page, Text, View, Image, StyleSheet, Font, Svg, Path, pdf } from "@react-pdf/renderer";

// Slide is 10in × 5.625in. Positions are inches from the template, ×72.
const IN = 72;
const W = 10 * IN, H = 5.625 * IN;
const TEAL = "#9CD5CF", TEAL_DEEP = "#1B3A38", TEAL_SOFT = "#EAF7F5", BLUE = "#008EFF", NAVY = "#0F172A", MUTED = "#64748B", HAIR = "#E2E8F0", GREEN = "#16A34A";

Font.register({
  family: "Raleway",
  fonts: [
    { src: "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaooCP.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVs9pYCP.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVtapYCP.ttf", fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

export interface ProposalLine { qty: string; desc: string; unit: string; services: string; amount: string }
export interface ProposalPlan {
  title: string;            // "Weekly Service"
  lines: ProposalLine[];    // itemization rows
  annualTotal: string;      // recurring, incl. tax
  monthlyTotal: string;
  oneTime: { label: string; amount: string }[];
  oneTimeTotal: string;
}
export interface ProposalData {
  baseUrl: string;          // where /proposal/*.png live (origin)
  locationName: string;
  serviceAddress: string;
  date: string;             // "September 7, 2026"
  mapUrl: string | null;    // proxy URL, or null when nothing was traced
  sqftTotal: string;        // "43,000"
  stations: string;         // "2"
  plans: ProposalPlan[];    // 1–2 plans (page 5 and 6)
  terms: { heading: string; items: string[] }[];
}

const S = StyleSheet.create({
  page: { width: W, height: H, fontFamily: "Helvetica", fontSize: 11, color: NAVY, position: "relative" },
  abs: { position: "absolute" },
  teal: { backgroundColor: TEAL },
  ral: { fontFamily: "Raleway" },
  b: { fontFamily: "Helvetica-Bold" },
  center: { textAlign: "center" },
  h1: { fontFamily: "Raleway", fontWeight: 800, fontSize: 28, color: NAVY },
  eyebrow: { fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 1.6, textTransform: "uppercase", color: BLUE },
  footer: { position: "absolute", left: 0.45 * IN, right: 0.45 * IN, bottom: 0.22 * IN, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: MUTED },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: HAIR, borderRadius: 10 },
});
const at = (x: number, y: number, w: number, h?: number) => ({ left: x * IN, top: y * IN, width: w * IN, ...(h ? { height: h * IN } : {}) });
const img = (base: string, file: string) => `${base}/proposal/${file}`;

function Footer({ d, page }: { d: ProposalData; page: number }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>DooGoodScoopers · Commercial Service Proposal{d.locationName ? ` · ${d.locationName}` : ""}</Text>
      <Text style={S.footerText}>{page}</Text>
    </View>
  );
}

function Check({ children, size = 11.5, gap = 6 }: { children: React.ReactNode; size?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: gap }}>
      <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: BLUE, marginRight: 8, marginTop: 1, alignItems: "center", justifyContent: "center" }}>
        <Svg width={8} height={8} viewBox="0 0 10 10"><Path d="M1.5 5.2 L4 7.6 L8.6 2.4" stroke="#FFFFFF" strokeWidth={1.8} fill="none" /></Svg>
      </View>
      <Text style={{ flex: 1, fontSize: size, lineHeight: 1.35, fontFamily: "Helvetica-Bold", color: TEAL_DEEP }}>{children}</Text>
    </View>
  );
}

function Bullet({ children, size = 10.5, gap = 3, color = NAVY }: { children: React.ReactNode; size?: number; gap?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: gap }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE, marginRight: 7, marginTop: size * 0.5 }} />
      <Text style={{ flex: 1, fontSize: size, lineHeight: 1.35, color }}>{children}</Text>
    </View>
  );
}

function Stat({ value, label, x, y, w }: { value: string; label: string; x: number; y: number; w: number }) {
  return (
    <View style={[S.abs, S.card, at(x, y, w), { padding: 8, paddingHorizontal: 10 }]}>
      <Text style={[S.ral, { fontSize: 16, fontWeight: 800, color: NAVY }]}>{value}</Text>
      <Text style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

/** Greedy fill: each section goes to the shortest column so far (length ≈ lines of text). */
function balanceColumns<T extends { heading: string; items: string[] }>(sections: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => []);
  const load = new Array(n).fill(0);
  const est = (s: T) => 1.6 + s.items.reduce((a, t) => a + Math.ceil(t.length / 52), 0);
  for (const sec of sections) { const i = load.indexOf(Math.min(...load)); cols[i].push(sec); load[i] += est(sec); }
  return cols;
}

const COLS = [0.95, 3.35, 1.25, 1.35, 1.6]; // inches; numeric columns right-aligned
function ItemTable({ lines }: { lines: ProposalLine[] }) {
  const head = ["Qty", "Description", "Unit price", "Services / yr", "Amount"];
  const right = new Set([0, 2, 3, 4]);
  const cell = (i: number, extra?: object) => ({ width: COLS[i] * IN, paddingVertical: 6, paddingHorizontal: 8, ...(extra || {}) });
  return (
    <View style={{ width: 8.5 * IN, borderWidth: 1, borderColor: HAIR, borderRadius: 8, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", backgroundColor: TEAL_DEEP }}>
        {head.map((h, i) => <View key={h} style={cell(i)}><Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", textAlign: right.has(i) ? "right" : "left" }}>{h}</Text></View>)}
      </View>
      {lines.map((l, r) => (
        <View key={r} style={{ flexDirection: "row", backgroundColor: r % 2 === 0 ? "#FFFFFF" : TEAL_SOFT, borderTopWidth: 1, borderTopColor: HAIR }}>
          {[l.qty, l.desc, l.unit, l.services, l.amount].map((v, i) => (
            <View key={i} style={cell(i)}><Text style={{ fontSize: 9, textAlign: right.has(i) ? "right" : "left", fontFamily: i === 4 ? "Helvetica-Bold" : "Helvetica", color: NAVY }}>{v}</Text></View>
          ))}
        </View>
      ))}
    </View>
  );
}

function PricingPage({ d, plan, page }: { d: ProposalData; plan: ProposalPlan; page: number }) {
  return (
    <Page size={[W, H]} style={S.page}>
      <Text style={[S.abs, S.eyebrow, at(0.75, 0.38, 6)]}>Options & pricing</Text>
      <Text style={[S.abs, S.h1, at(0.75, 0.58, 8.5), { fontSize: 26 }]}>{plan.title}</Text>
      <View style={[S.abs, at(0.75, 1.2, 8.5)]}><ItemTable lines={plan.lines} /></View>

      {/* Summary cards */}
      <View style={[S.abs, S.card, at(0.75, 3.95, 4.1, 1.25), { padding: 12 }]}>
        <Text style={S.eyebrow}>One-time fees</Text>
        {plan.oneTime.length === 0 ? <Text style={{ fontSize: 10, marginTop: 6, color: MUTED }}>None</Text> : plan.oneTime.map((o) => (
          <View key={o.label} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ fontSize: 9.5, color: MUTED }}>{o.label}</Text><Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold" }}>{o.amount}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: HAIR }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>Total due on acceptance</Text><Text style={[S.ral, { fontSize: 13, fontWeight: 800 }]}>{plan.oneTimeTotal}</Text>
        </View>
      </View>
      <View style={[S.abs, at(5.15, 3.95, 4.1, 1.25), { backgroundColor: TEAL_DEEP, borderRadius: 10, padding: 12 }]}>
        <Text style={[S.eyebrow, { color: TEAL }]}>Recurring service</Text>
        <Text style={[S.ral, { fontSize: 26, fontWeight: 800, color: "#FFFFFF", marginTop: 2 }]}>{plan.monthlyTotal}<Text style={{ fontSize: 11, fontWeight: 700, color: TEAL }}>  / month</Text></Text>
        <Text style={{ fontSize: 9.5, color: "#D5EEEB", marginTop: 3 }}>Annual service total {plan.annualTotal}</Text>
        <Text style={{ fontSize: 8, color: TEAL, marginTop: 6 }}>5% pay-in-full discount available  ·  totals include sales tax</Text>
      </View>
      <Footer d={d} page={page} />
    </Page>
  );
}

export function ProposalPdf({ d }: { d: ProposalData }) {
  const base = d.baseUrl;
  const pricingStart = 5;
  return (
    <Document title={`${d.locationName || "Community"} — DooGoodScoopers Proposal`} author="DooGoodScoopers">
      {/* 1 · Cover */}
      <Page size={[W, H]} style={[S.page, S.teal]}>
        <View style={[S.abs, { left: 0, top: 0, width: 2.6 * IN, height: 2.6 * IN, borderBottomRightRadius: 2.6 * IN, backgroundColor: "#FFFFFF", opacity: 0.18 }]} />
        <View style={[S.abs, { left: 7.6 * IN, top: 3.6 * IN, width: 2.4 * IN, height: 2.025 * IN, borderTopLeftRadius: 2.4 * IN, backgroundColor: "#FFFFFF", opacity: 0.14 }]} />
        <Image src={img(base, "logo.png")} style={[S.abs, at(1.9, 0.7, 6.2, 2.07)]} />
        <Text style={[S.abs, S.eyebrow, S.center, at(0.6, 3.0, 8.8), { color: TEAL_DEEP }]}>Commercial service proposal</Text>
        <Text style={[S.abs, S.ral, S.center, at(0.6, 3.2, 8.8), { fontSize: 32, fontWeight: 800, color: "#FFFFFF" }]}>{d.locationName || "Your Community"}</Text>
        <Text style={[S.abs, S.center, at(0.6, 3.88, 8.8), { fontSize: 13, color: TEAL_DEEP }]}>{d.serviceAddress || " "}</Text>
        <View style={[S.abs, at(3.7, 4.5, 2.6, 0.52), { backgroundColor: "#FFFFFF", borderRadius: 26, justifyContent: "center" }]}>
          <Text style={[S.center, S.ral, { fontSize: 13, fontWeight: 700, color: TEAL_DEEP }]}>{d.date}</Text>
        </View>
      </Page>

      {/* 2 · Outline */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(0, 0, 4.2, 5.625)]} />
        <Text style={[S.abs, S.eyebrow, at(0.7, 0.55, 3), { color: TEAL_DEEP }]}>What's inside</Text>
        <Text style={[S.abs, S.ral, at(0.7, 0.78, 3.3), { fontSize: 44, fontWeight: 800, color: TEAL_DEEP }]}>Outline</Text>
        <Image src={img(base, "logo.png")} style={[S.abs, at(0.55, 4.05, 3.0, 1.0)]} />
        <View style={[S.abs, at(4.9, 1.0, 4.5)]}>
          {[["01", "About DooGoodScoopers", "Who we are and why communities choose us."], ["02", "Common Area Cleaning", "The areas we service on your property, mapped."], ["03", "Options & Pricing", "Two service frequencies, itemized, with one-time start-up costs."]].map(([n, t, s]) => (
            <View key={n} style={{ flexDirection: "row", marginBottom: 22 }}>
              <Text style={[S.ral, { fontSize: 26, fontWeight: 800, color: BLUE, width: 46 }]}>{n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[S.ral, { fontSize: 17, fontWeight: 700, color: NAVY }]}>{t}</Text>
                <Text style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{s}</Text>
              </View>
            </View>
          ))}
        </View>
        <Footer d={d} page={2} />
      </Page>

      {/* 3 · About */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(0, 0, 4.9, 5.625)]} />
        <Image src={img(base, "logo.png")} style={[S.abs, at(0.6, 0.45, 2.7, 0.9)]} />
        <Text style={[S.abs, S.eyebrow, at(0.6, 1.55, 4), { color: TEAL_DEEP }]}>About us</Text>
        <Text style={[S.abs, S.ral, at(0.6, 1.75, 4.1), { fontSize: 22, fontWeight: 800, color: TEAL_DEEP }]}>Why communities choose DooGoodScoopers</Text>
        <View style={[S.abs, at(0.6, 2.75, 4.0)]}>
          {["Licensed, bonded, and insured", "Clean, branded vehicles and uniforms", "5-star communication", "Unmatched reliability and professionalism", "Service plans tailored to your property"].map((t) => <Check key={t}>{t}</Check>)}
        </View>
        <Text style={[S.abs, S.ral, at(5.25, 0.5, 4.3), { fontSize: 26, fontWeight: 800, color: NAVY }]}>DooGoodScoopers</Text>
        <Text style={[S.abs, at(5.25, 0.95, 4.3), { fontSize: 10.5, color: MUTED, lineHeight: 1.4 }]}>Inland Empire's pooper scooper service for homes, HOAs, apartments, and 55+ communities.</Text>
        {/* photo grid */}
        <Image src={img(base, "photo-truck.jpg")} style={[S.abs, at(5.25, 1.6, 2.1, 1.65), { objectFit: "cover", borderRadius: 8 }]} />
        <Image src={img(base, "photo-4.jpg")} style={[S.abs, at(7.5, 1.6, 2.05, 1.65), { objectFit: "cover", borderRadius: 8 }]} />
        <Image src={img(base, "photo-5.jpg")} style={[S.abs, at(5.25, 3.4, 2.1, 1.65), { objectFit: "cover", borderRadius: 8 }]} />
        <Image src={img(base, "photo-3.jpg")} style={[S.abs, at(7.5, 3.4, 2.05, 1.65), { objectFit: "cover", borderRadius: 8 }]} />
        <Footer d={d} page={3} />
      </Page>

      {/* 4 · Property */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(5.35, 0, 4.65, 5.625)]} />
        <Text style={[S.abs, S.eyebrow, at(0.45, 0.38, 4.8)]}>Common area cleaning</Text>
        <Text style={[S.abs, S.ral, at(0.45, 0.58, 4.8), { fontSize: 15, fontWeight: 800, color: NAVY }]}>{d.serviceAddress || "Service address"}</Text>
        <View style={[S.abs, at(0.45, 1.05, 4.6, 3.1), { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: HAIR, backgroundColor: "#EEF2F5", justifyContent: "center" }]}>
          {d.mapUrl
            ? <Image src={d.mapUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Text style={[S.center, { fontSize: 10, color: MUTED }]}>Service map — trace the common areas on the quote map to include it here</Text>}
        </View>
        <View style={[S.abs, at(0.45, 4.25, 4.6), { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 20, height: 11, backgroundColor: BLUE, opacity: 0.5, marginRight: 6, borderRadius: 2, borderWidth: 1.5, borderColor: BLUE }} />
          <Text style={{ fontSize: 9, color: MUTED }}>Shaded areas are cleaned each visit</Text>
        </View>
        <Stat value={`${d.sqftTotal} sq ft`} label="Approximate serviceable area" x={0.45} y={4.55} w={2.2} />
        <Stat value={`${d.stations}`} label="Pet-waste stations" x={2.85} y={4.55} w={2.2} />

        <Image src={img(base, "icon-6.png")} style={[S.abs, at(8.85, 0.25, 0.8, 0.8)]} />
        <Text style={[S.abs, S.eyebrow, at(5.75, 0.45, 3.0), { color: TEAL_DEEP }]}>Notes</Text>
        <Text style={[S.abs, S.ral, at(5.75, 0.65, 3.0), { fontSize: 18, fontWeight: 800, color: TEAL_DEEP }]}>Regarding this property</Text>
        <View style={[S.abs, at(5.75, 1.45, 3.8)]}>
          <Bullet size={10.5} gap={9} color={TEAL_DEEP}>The initial clean-up covers waste in targeted areas and throughout the lot.</Bullet>
          <Bullet size={10.5} gap={9} color={TEAL_DEEP}>Approximately {d.sqftTotal} sq ft in total to be cleaned across the swales and pavement.</Bullet>
          <Bullet size={10.5} gap={9} color={TEAL_DEEP}>Install and maintain up to {d.stations} waste station{d.stations === "1" ? "" : "s"}. Station locations are subject to change.</Bullet>
          <Bullet size={10.5} gap={9} color={TEAL_DEEP}>Approximately {d.sqftTotal} sq ft in total to be cleaned across the property on regular visits.</Bullet>
          <Bullet size={10.5} gap={9} color={TEAL_DEEP}>After the initial clean-up, service is inside the lot only.</Bullet>
        </View>
        <Footer d={d} page={4} />
      </Page>

      {/* 5 + 6 · Pricing options */}
      {d.plans.map((p, i) => <PricingPage key={p.title} d={d} plan={p} page={pricingStart + i} />)}

      {/* 7 · Terms — three columns, balanced by estimated length so nothing spills to a 9th page */}
      <Page size={[W, H]} style={S.page}>
        <Text style={[S.abs, S.eyebrow, at(0.6, 0.38, 6)]}>The fine print</Text>
        <Text style={[S.abs, S.h1, at(0.6, 0.58, 8), { fontSize: 24 }]}>Terms & Conditions</Text>
        <View style={[S.abs, at(0.6, 1.15, 8.8, 4.1), { flexDirection: "row", overflow: "hidden" }]}>
          {balanceColumns(d.terms, 3).map((col, ci) => (
            <View key={ci} style={{ width: 2.8 * IN, marginRight: ci < 2 ? 0.2 * IN : 0 }}>
              {col.map((sec) => (
                <View key={sec.heading} style={{ marginBottom: 8 }}>
                  <Text style={[S.ral, { fontSize: 10, fontWeight: 700, color: TEAL_DEEP, marginBottom: 3 }]}>{sec.heading}</Text>
                  {sec.items.map((t, i) => <Bullet key={i} size={8.2} gap={2.5} color="#334155">{t}</Bullet>)}
                </View>
              ))}
            </View>
          ))}
        </View>
        <Footer d={d} page={pricingStart + d.plans.length} />
      </Page>

      {/* 8 · Approval */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(0, 0, 10, 1.55)]} />
        <Image src={img(base, "logo.png")} style={[S.abs, at(0.6, 0.35, 2.6, 0.87)]} />
        <Text style={[S.abs, S.eyebrow, at(0.6, 1.9, 8), { color: BLUE }]}>Approval</Text>
        <Text style={[S.abs, S.ral, at(0.6, 2.1, 8.8), { fontSize: 22, fontWeight: 800, color: NAVY }]}>{d.locationName || "Your Community"} approves this proposal</Text>
        <Text style={[S.abs, at(0.6, 2.55, 8.5), { fontSize: 9.5, color: MUTED }]}>Signing confirms the selected service option, the one-time fees, and the terms on the previous page. We'll schedule the initial clean-up within a week of approval.</Text>
        <View style={[S.abs, at(0.6, 3.15, 8.8), { flexDirection: "row" }]}>
          {[["Name", 2.9], ["Title", 2.9], ["Date", 2.2]].map(([l, w]) => (
            <View key={String(l)} style={{ width: Number(w) * IN, marginRight: 0.3 * IN }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: NAVY, height: 26 }} />
              <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 4 }}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={[S.abs, at(0.6, 4.05, 6.1)]}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: NAVY, height: 30 }} />
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 4 }}>Signature</Text>
        </View>
        <View style={[S.abs, S.card, at(7.0, 3.95, 2.4), { padding: 10 }]}>
          <Text style={[S.ral, { fontSize: 11, fontWeight: 700, color: NAVY }]}>Questions?</Text>
          <Text style={{ fontSize: 9, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>(909) 366-3744{"\n"}service@doogoodscoopers.com{"\n"}doogoodscoopers.com</Text>
        </View>
        <Footer d={d} page={pricingStart + d.plans.length + 1} />
      </Page>
    </Document>
  );
}

/** Build the proposal PDF and download it in the browser. */
export async function downloadProposalPdf(d: ProposalData): Promise<void> {
  const blob = await pdf(<ProposalPdf d={d} />).toBlob();
  const slug = (d.locationName || "community").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "community";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-proposal.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
