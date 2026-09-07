// The commercial proposal deck as a real PDF: eight 16:9 pages rebuilt from the
// DooGoodScoopers-Proposal template, filled from the Community Quote. Static
// pages (2, 3, 7) are fixed; the rest take the property, address, date, map,
// square footage, station count, and two priced service options.

import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";

// Slide is 10in × 5.625in. Positions below are inches from the template, ×72.
const IN = 72;
const W = 10 * IN, H = 5.625 * IN;
const TEAL = "#9CD5CF", BLUE = "#008EFF", NAVY = "#1F497D", ROW = "#B6BFD6", GREEN = "#6AA84F", INK = "#111111";

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
  page: { width: W, height: H, fontFamily: "Helvetica", fontSize: 11, color: INK, position: "relative" },
  abs: { position: "absolute" },
  teal: { backgroundColor: TEAL },
  raleway: { fontFamily: "Raleway" },
  b: { fontFamily: "Helvetica-Bold" },
  white: { color: "#FFFFFF" },
  center: { textAlign: "center" },
  th: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  td: { fontSize: 9 },
});
const at = (x: number, y: number, w: number, h?: number) => ({ left: x * IN, top: y * IN, width: w * IN, ...(h ? { height: h * IN } : {}) });
const img = (base: string, file: string) => `${base}/proposal/${file}`;

function Bullet({ children, size = 10.5, gap = 3 }: { children: React.ReactNode; size?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: gap }}>
      <Text style={{ width: 10, fontSize: size }}>•</Text>
      <Text style={{ flex: 1, fontSize: size, lineHeight: 1.3 }}>{children}</Text>
    </View>
  );
}

const COLS = [1.25, 2.19, 1.5, 1.39, 2.18]; // inches, from the template's table
function ItemTable({ lines }: { lines: ProposalLine[] }) {
  const head = ["Quantity", "Description", "Unit Price", "Number of Services", "Annual Amount"];
  const cell = (i: number, extra?: object) => ({ width: COLS[i] * IN, paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#FFFFFF", ...(extra || {}) });
  return (
    <View style={{ width: 8.51 * IN }}>
      <View style={{ flexDirection: "row", backgroundColor: NAVY }}>
        {head.map((h, i) => <View key={h} style={cell(i)}><Text style={S.th}>{h}</Text></View>)}
      </View>
      {lines.map((l, r) => (
        <View key={r} style={{ flexDirection: "row", backgroundColor: r % 2 === 0 ? "#FFFFFF" : ROW, borderBottomWidth: 0.5, borderBottomColor: "#D9DEE8" }}>
          {[l.qty, l.desc, l.unit, l.services, l.amount].map((v, i) => <View key={i} style={cell(i)}><Text style={S.td}>{v}</Text></View>)}
        </View>
      ))}
    </View>
  );
}

function PricingPage({ plan }: { plan: ProposalPlan }) {
  return (
    <Page size={[W, H]} style={S.page}>
      <Text style={[S.abs, S.raleway, at(0.9, 0.18, 8.2), { fontSize: 30, fontWeight: 700 }]}>Itemization ({plan.title}):</Text>
      <View style={[S.abs, at(0.67, 1.04, 8.51)]}><ItemTable lines={plan.lines} /></View>
      <View style={[S.abs, at(1.06, 4.08, 3.8)]}>
        <Text style={[S.b, { fontSize: 12 }]}>One Time Fees</Text>
        {plan.oneTime.length === 0 ? <Text style={{ fontSize: 11, marginTop: 4 }}>None</Text> : plan.oneTime.map((o) => (
          <Text key={o.label} style={[S.b, { fontSize: 11, marginTop: 3 }]}>{o.label}: {o.amount}</Text>
        ))}
        <Text style={[S.b, { fontSize: 12, marginTop: 6 }]}>Total: {plan.oneTimeTotal}</Text>
      </View>
      <View style={[S.abs, at(5.3, 4.08, 4.3)]}>
        <Text style={[S.b, { fontSize: 12 }]}>Recurring Service Costs</Text>
        <Text style={[S.b, { fontSize: 11, marginTop: 4 }]}>Annual Service Total: {plan.annualTotal}</Text>
        <Text style={[S.b, { fontSize: 12, marginTop: 3, color: GREEN }]}>Monthly Service Payment: {plan.monthlyTotal}</Text>
        <Text style={{ fontSize: 9.5, marginTop: 6, color: "#444" }}>5% Pay in Full Discount Available  |  Price Totals Include Tax</Text>
      </View>
    </Page>
  );
}

export function ProposalPdf({ d }: { d: ProposalData }) {
  const base = d.baseUrl;
  return (
    <Document title={`${d.locationName || "Community"} — DooGoodScoopers Proposal`} author="DooGoodScoopers">
      {/* 1 · Cover */}
      <Page size={[W, H]} style={[S.page, S.teal]}>
        <Image src={img(base, "logo.png")} style={[S.abs, at(1.45, 0.65, 6.82, 2.27)]} />
        <Text style={[S.abs, S.raleway, S.white, S.center, at(0.6, 3.15, 8.8), { fontSize: 34, fontWeight: 800 }]}>{d.locationName || "Your Community"}</Text>
        <Text style={[S.abs, S.center, at(0.6, 3.82, 8.8), { fontSize: 15, color: "#1B3A38" }]}>{d.serviceAddress || " "}</Text>
        <View style={[S.abs, at(3.6, 4.5, 2.8, 0.6), { backgroundColor: "#FFFFFF", borderRadius: 6, justifyContent: "center" }]}>
          <Text style={[S.center, S.raleway, { fontSize: 16, fontWeight: 700, color: "#1B3A38" }]}>{d.date}</Text>
        </View>
      </Page>

      {/* 2 · Outline */}
      <Page size={[W, H]} style={[S.page, S.teal]}>
        <Text style={[S.abs, S.raleway, at(0.71, 0.35, 5), { fontSize: 52, fontWeight: 800, color: "#1B3A38" }]}>Outline</Text>
        <View style={[S.abs, at(0.75, 1.95, 5)]}>
          {["About DooGoodScoopers", "Common Area Cleaning", "Options & Pricing"].map((t) => <Text key={t} style={{ fontSize: 22, marginBottom: 14, color: "#1B3A38" }}>{t}</Text>)}
        </View>
        <Image src={img(base, "logo.png")} style={[S.abs, at(5.11, 1.82, 4.66, 1.55)]} />
      </Page>

      {/* 3 · About */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(0, 0, 5.03, 5.625)]} />
        <Image src={img(base, "logo.png")} style={[S.abs, at(1.0, 0.45, 2.72, 0.91)]} />
        <Text style={[S.abs, S.b, at(0.49, 1.2, 4.2), { fontSize: 18, color: "#1B3A38" }]}>Why Choose DooGoodScoopers?</Text>
        <View style={[S.abs, at(0.49, 1.75, 4.3)]}>
          {["Licensed, Bonded, and Insured", "Clean and Branded Vehicles & Uniforms", "5-Star Communication", "Unmatched Reliability and Professionalism", "Tailored Service Plans For Your Needs"].map((t) => (
            <View key={t} style={{ flexDirection: "row", marginBottom: 4 }}><Text style={[S.b, { width: 10, fontSize: 12 }]}>•</Text><Text style={[S.b, { fontSize: 12 }]}>{t}</Text></View>
          ))}
        </View>
        <Image src={img(base, "photo-3.jpg")} style={[S.abs, at(1.05, 3.32, 2.81, 2.1), { objectFit: "cover" }]} />
        <Text style={[S.abs, S.raleway, S.center, at(5.03, 0.5, 4.91), { fontSize: 32, fontWeight: 800 }]}>DooGoodScoopers</Text>
        <Image src={img(base, "photo-truck.jpg")} style={[S.abs, at(5.41, 1.6, 1.83, 1.37), { objectFit: "cover" }]} />
        <Image src={img(base, "photo-4.jpg")} style={[S.abs, at(7.22, 2.03, 2.6, 1.95), { objectFit: "cover" }]} />
        <Image src={img(base, "photo-5.jpg")} style={[S.abs, at(5.31, 3.48, 1.95, 1.46), { objectFit: "cover" }]} />
      </Page>

      {/* 4 · Property */}
      <Page size={[W, H]} style={S.page}>
        <View style={[S.abs, S.teal, at(5.0, 0, 5.0, 5.625)]} />
        <Text style={[S.abs, S.b, S.center, at(0.3, 0.2, 4.4), { fontSize: 13 }]}>{d.serviceAddress || "Service address"}</Text>
        <Text style={[S.abs, S.b, at(0.45, 0.75, 3), { fontSize: 12, color: "#1B3A38" }]}>Areas to be cleaned</Text>
        <View style={[S.abs, at(0.17, 1.15, 4.67, 3.15), { borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#EEF2F5", overflow: "hidden", justifyContent: "center" }]}>
          {d.mapUrl
            ? <Image src={d.mapUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Text style={[S.center, { fontSize: 10, color: "#64748B" }]}>Service map — trace the common areas on the quote map to include it here</Text>}
        </View>
        <View style={[S.abs, at(0.17, 4.42, 4.67), { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ width: 22, height: 12, backgroundColor: BLUE, opacity: 0.45, marginRight: 6, borderWidth: 1.5, borderColor: BLUE }} />
          <Text style={{ fontSize: 10, color: "#334155" }}>Shaded areas are cleaned each visit</Text>
        </View>
        <Text style={[S.abs, at(0.33, 4.9, 4.5), { fontSize: 14 }]}>Approx {d.sqftTotal} Sq ft.</Text>
        <Image src={img(base, "icon-6.png")} style={[S.abs, at(8.9, 0.08, 0.87, 0.87)]} />
        <Text style={[S.abs, S.b, S.center, at(5.4, 0.35, 3.6), { fontSize: 14, color: "#1B3A38" }]}>Notes Regarding this Property</Text>
        <View style={[S.abs, at(5.2, 1.0, 4.6)]}>
          <Bullet size={11} gap={9}>The initial clean up will include cleaning waste in targeted areas and throughout the lot.</Bullet>
          <Bullet size={11} gap={9}>Approximately {d.sqftTotal} sq. ft in total to be cleaned across the swales/pavement.</Bullet>
          <Bullet size={11} gap={9}>Install/maintain up to {d.stations} waste stations (station locations are subject to change).</Bullet>
          <Bullet size={11} gap={9}>Approximately {d.sqftTotal} sq. ft in total to be cleaned across the property for regular cleanups.</Bullet>
          <Bullet size={11} gap={9}>We will only clean inside the lot after the initial cleanup.</Bullet>
        </View>
      </Page>

      {/* 5 + 6 · Pricing options */}
      {d.plans.map((p) => <PricingPage key={p.title} plan={p} />)}

      {/* 7 · Terms */}
      <Page size={[W, H]} style={S.page}>
        <Text style={[S.abs, S.raleway, S.center, at(0.34, 0.16, 9.32), { fontSize: 24, fontWeight: 800 }]}>Terms & Conditions</Text>
        <View style={[S.abs, at(0.42, 0.72, 9.16), { flexDirection: "row" }]}>
          {[0, 1].map((col) => (
            <View key={col} style={{ width: 4.5 * IN, marginRight: col === 0 ? 0.16 * IN : 0 }}>
              {d.terms.filter((_, i) => i % 2 === col).map((sec) => (
                <View key={sec.heading} style={{ marginBottom: 8 }}>
                  <Text style={[S.b, { fontSize: 10.5, marginBottom: 3 }]}>{sec.heading}</Text>
                  {sec.items.map((t, i) => <Bullet key={i} size={9.2} gap={2.5}>{t}</Bullet>)}
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>

      {/* 8 · Approval */}
      <Page size={[W, H]} style={S.page}>
        <Text style={[S.abs, S.raleway, S.center, at(1.2, 0.94, 7.6), { fontSize: 24, fontWeight: 700, lineHeight: 1.3 }]}>{d.locationName || "Your Community"} approves{"\n"}this proposal:</Text>
        <View style={[S.abs, at(1.5, 2.65, 6.85)]}>
          {["Name", "Title", "Signature", "Date"].map((l) => (
            <View key={l} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 22 }}>
              <Text style={{ fontSize: 13, width: 80 }}>{l}:</Text>
              <View style={{ flex: l === "Date" ? 0.45 : 1, borderBottomWidth: 1, borderBottomColor: INK }} />
            </View>
          ))}
        </View>
        <Text style={[S.abs, S.center, at(1, 5.05, 8), { fontSize: 9, color: "#64748B" }]}>DooGoodScoopers · (909) 366-3744 · doogoodscoopers.com</Text>
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
