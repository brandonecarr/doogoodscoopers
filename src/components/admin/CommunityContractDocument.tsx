// True PDF service agreement generated from the Community Quote inputs.
// Built with @react-pdf/renderer so "Export PDF" downloads a real .pdf file
// (vector text, selectable, real pagination) — not a browser print dialog.

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export type ContractData = {
  providerEntity: string;
  providerAddress: string;
  providerPhone: string;
  providerEmail: string;
  clientLegalName: string;
  propertyAddress: string;
  clientContact: string;
  clientEmail: string;
  effectiveDate: string; // ISO yyyy-mm-dd
  termMonths: string;
  netDays: string;
  lateFeePct: string;
  governingState: string;
  acres: string;
  units: string;
  freq: number;
  visitsMo: string;
  stations: number;
  monthlyTotal: string;
  perUnitMo: string;
  oneTime: string;
  hasOneTime: boolean;
};

const blank = (v: string) => (v && v.trim() ? v.trim() : "________________");

function fmtDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "________________";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 60, paddingHorizontal: 56, fontFamily: "Times-Roman", fontSize: 11, lineHeight: 1.45, color: "#111" },
  title: { fontSize: 16, fontFamily: "Times-Bold", textAlign: "center", marginBottom: 3 },
  sub: { fontSize: 10, textAlign: "center", color: "#444", marginBottom: 14 },
  intro: { marginBottom: 12, textAlign: "justify" },
  h2: { fontSize: 11.5, fontFamily: "Times-Bold", marginTop: 13, marginBottom: 5, textTransform: "uppercase", borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 2 },
  h3: { fontSize: 11, fontFamily: "Times-BoldItalic", marginTop: 6, marginBottom: 3 },
  p: { marginBottom: 6, textAlign: "justify" },
  li: { marginBottom: 3, textAlign: "justify" },
  indent: { paddingLeft: 16 },
  bold: { fontFamily: "Times-Bold" },
  section: { marginBottom: 2 },
  noticeRow: { flexDirection: "row", marginTop: 4, marginBottom: 4 },
  noticeCol: { flex: 1, paddingRight: 14 },
  noticeName: { fontFamily: "Times-Bold", marginBottom: 1 },
  sigRow: { flexDirection: "row", marginTop: 24 },
  sigCol: { flex: 1, paddingRight: 20 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#111", marginTop: 26, paddingTop: 2, fontSize: 10 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, textAlign: "center", fontSize: 8, color: "#999" },
});

function ContractPdf({ d }: { d: ContractData }) {
  const term = blank(d.termMonths);
  const net = blank(d.netDays);
  const late = blank(d.lateFeePct);
  const state = d.governingState?.trim() || "California";
  const eff = fmtDate(d.effectiveDate);

  return (
    <Document title={`${d.clientLegalName || "Community"} — Service Agreement`} author={d.providerEntity}>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>Pet Waste Removal Service Agreement</Text>
        <Text style={styles.sub}>{d.providerEntity}  •  {d.providerPhone}</Text>

        <Text style={styles.intro}>
          This Pet Waste Removal Service Agreement (this &ldquo;Agreement&rdquo;) is entered into as of {eff} by and between{" "}
          {blank(d.providerEntity)} (&ldquo;Provider&rdquo;) and {blank(d.clientLegalName)} (&ldquo;Client&rdquo;), for
          services performed at {blank(d.propertyAddress)} (the &ldquo;Property&rdquo;). Provider and Client are each a
          &ldquo;Party&rdquo; and together the &ldquo;Parties.&rdquo;
        </Text>

        {/* 1 */}
        <View style={styles.section}>
          <Text style={styles.h2}>1. Description of Services</Text>
          <Text style={styles.p}>
            Provider agrees to furnish professional dog-waste-removal (&ldquo;pet waste&rdquo;) services for the common
            areas and designated pet-relief areas of the Property, as further described below. Provider shall supply all
            labor, equipment, collection bags, and disposal necessary to perform the Services.
          </Text>
          <Text style={styles.h3}>1.1 Service Details</Text>
          <Text style={styles.p}>
            The Services consist of the systematic inspection and removal of pet waste from approximately {blank(d.acres)}{" "}
            acre(s) of serviceable common area at the Property, performed {d.freq} time(s) per week (approximately{" "}
            {d.visitsMo} service visits per month).
            {d.stations > 0
              ? ` Provider shall also service ${d.stations} pet-waste station(s) at the Property, including restocking waste bags and emptying receptacles.`
              : ""}{" "}
            All collected waste shall be removed from the Property and disposed of in accordance with applicable law.
            Services are performed during normal daylight hours; specific service days may be adjusted by Provider for
            weather, holidays, or scheduling, with reasonable notice to Client. This Agreement covers common areas only and
            does not include private patios, yards, balconies, or interior spaces unless separately agreed in writing.
          </Text>
        </View>

        {/* 2 */}
        <View style={styles.section}>
          <Text style={styles.h2}>2. Payment</Text>
          <Text style={styles.h3}>2.1 Payment Terms</Text>
          <Text style={styles.p}>
            The recurring service fee is {blank(d.monthlyTotal)} per month ({blank(d.perUnitMo)} per unit per month across{" "}
            {blank(d.units)} units).
            {d.hasOneTime
              ? ` A one-time start-up fee of ${d.oneTime}, covering initial cleanup and/or station installation, is due upon execution of this Agreement.`
              : ""}
          </Text>
          <Text style={styles.p}>
            <Text style={styles.bold}>Automatic Payment (Auto-Pay) Required. </Text>
            Client shall keep a valid credit card or bank account on file and hereby authorizes Provider to automatically
            charge the monthly service fee to that payment method on the first (1st) day of each month, in advance, for
            that month&rsquo;s Services. Enrollment in Auto-Pay is a condition of Service under this Agreement. If a
            scheduled charge is declined or otherwise fails, Provider will notify Client, and Client shall cure the failed
            payment within {net} days. Any amount not cured within that period shall accrue a late charge of {late}% per
            month (or the maximum rate permitted by law, if lower) on the outstanding balance, and Provider may suspend
            Services until payment is received. Provider may adjust the fees upon at least thirty (30) days&rsquo; prior
            written notice, or sooner upon a material change in the scope, serviceable area, or dog population at the
            Property. Client is responsible for any returned-payment fees and the reasonable costs of collection.
          </Text>
        </View>

        {/* 3 */}
        <View style={styles.section}>
          <Text style={styles.h2}>3. Warranties</Text>
          <Text style={styles.p}>
            Provider warrants that the Services will be performed in a professional and workmanlike manner consistent with
            industry standards. Provider maintains commercial general liability insurance for the protection of Client and
            the Property, and shall furnish a certificate of insurance upon Client&rsquo;s written request. EXCEPT AS
            EXPRESSLY STATED IN THIS AGREEMENT, PROVIDER MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY
            IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Provider does not warrant that the
            Property will remain free of pet waste between scheduled service visits. Client represents and warrants that it
            has full authority to enter into this Agreement and to grant Provider access to the Property, and that all
            animals at the Property are properly vaccinated and restrained during service visits.
          </Text>
        </View>

        {/* 4 */}
        <View style={styles.section}>
          <Text style={styles.h2}>4. Term</Text>
          <Text style={styles.p}>
            This Agreement begins on the Effective Date and continues for an initial term of {term} months. Thereafter, it
            renews automatically for successive month-to-month periods unless either Party gives notice of non-renewal or
            termination in accordance with the Cancellation Policy below.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.bold}>Cancellation Policy. </Text>
            To cancel or terminate this Agreement, either Party must provide at least thirty (30) days&rsquo; prior written
            notice. Because Services are billed monthly in advance by Auto-Pay on the first (1st) of each month, the fee
            for the then-current month is non-refundable, Services will continue through the end of that paid month, and no
            partial-month or prorated refunds will be issued. Client remains responsible for all fees for Services rendered
            and for the current billing month through the effective date of cancellation. Cancellation does not waive any
            amounts already due.
          </Text>
        </View>

        {/* 5 */}
        <View style={styles.section}>
          <Text style={styles.h2}>5. Default</Text>
          <Text style={styles.p}>The occurrence of any of the following shall constitute a material default under this Agreement:</Text>
          <View style={styles.indent}>
            <Text style={styles.li}>(a) Failure to make any payment when due that remains uncured for ten (10) days after written notice;</Text>
            <Text style={styles.li}>(b) Failure to perform or observe any material obligation under this Agreement that remains uncured for fifteen (15) days after written notice;</Text>
            <Text style={styles.li}>(c) Denial of safe and reasonable access to the Property required to perform the Services;</Text>
            <Text style={styles.li}>(d) The insolvency or bankruptcy of, or an assignment for the benefit of creditors by, either Party; or</Text>
            <Text style={styles.li}>(e) Any material misrepresentation made by either Party in connection with this Agreement.</Text>
          </View>
        </View>

        {/* 6 */}
        <View style={styles.section}>
          <Text style={styles.h2}>6. Remedies on Default</Text>
          <Text style={styles.p}>
            Upon a material default that remains uncured beyond the applicable cure period, the non-defaulting Party may, in
            addition to any other remedy available at law or in equity: (a) suspend its performance under this Agreement;
            (b) terminate this Agreement immediately upon written notice; and (c) recover all amounts then due and owing,
            together with interest and the reasonable costs of collection, including reasonable attorneys&rsquo; fees. All
            remedies are cumulative and not exclusive. In no event shall either Party be liable for indirect, incidental,
            special, or consequential damages.
          </Text>
        </View>

        {/* 7 */}
        <View style={styles.section}>
          <Text style={styles.h2}>7. Dispute Resolution</Text>
          <Text style={styles.p}>
            This Agreement shall be governed by the laws of the State of {state}, without regard to its conflict-of-laws
            principles. The Parties shall first attempt in good faith to resolve any dispute through direct negotiation. If
            the dispute is not resolved within thirty (30) days, the Parties agree to submit it to non-binding mediation,
            sharing the mediator&rsquo;s fees equally. Any dispute not resolved by mediation may be brought in the state or
            federal courts located in {state}, or, at either Party&rsquo;s election for amounts within its jurisdiction, in
            small claims court. The prevailing Party shall be entitled to recover its reasonable attorneys&rsquo; fees and
            costs.
          </Text>
        </View>

        {/* 8 */}
        <View style={styles.section}>
          <Text style={styles.h2}>8. Confidentiality</Text>
          <Text style={styles.p}>
            Each Party may have access to non-public information of the other, including pricing, resident information, and
            business operations (&ldquo;Confidential Information&rdquo;). Each Party agrees to use the other&rsquo;s
            Confidential Information solely to perform this Agreement and to protect it with at least reasonable care. This
            obligation survives termination for two (2) years. It does not apply to information that is or becomes public
            through no fault of the receiving Party, is independently developed, or is required to be disclosed by law.
          </Text>
        </View>

        {/* 9 */}
        <View style={styles.section}>
          <Text style={styles.h2}>9. Notice</Text>
          <Text style={styles.p}>
            All notices under this Agreement shall be in writing and delivered by hand, by email with confirmation of
            receipt, or by nationally recognized courier, to the addresses below (or as updated by written notice):
          </Text>
          <View style={styles.noticeRow}>
            <View style={styles.noticeCol}>
              <Text style={styles.noticeName}>Provider</Text>
              <Text>{blank(d.providerEntity)}</Text>
              <Text>{blank(d.providerAddress)}</Text>
              <Text>{blank(d.providerPhone)}</Text>
              <Text>{blank(d.providerEmail)}</Text>
            </View>
            <View style={styles.noticeCol}>
              <Text style={styles.noticeName}>Client</Text>
              <Text>{blank(d.clientLegalName)}</Text>
              <Text>{blank(d.propertyAddress)}</Text>
              <Text>Attn: {blank(d.clientContact)}</Text>
              <Text>{blank(d.clientEmail)}</Text>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.section} wrap={false}>
          <Text style={{ marginTop: 12 }}>
            IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.
          </Text>
          <View style={styles.sigRow}>
            <View style={styles.sigCol}>
              <Text style={styles.sigLine}>Provider signature</Text>
              <Text style={{ marginTop: 2 }}>{blank(d.providerEntity)}</Text>
              <Text style={styles.sigLine}>Name / Title</Text>
              <Text style={styles.sigLine}>Date</Text>
            </View>
            <View style={styles.sigCol}>
              <Text style={styles.sigLine}>Client signature</Text>
              <Text style={{ marginTop: 2 }}>{blank(d.clientLegalName)}</Text>
              <Text style={styles.sigLine}>Name / Title</Text>
              <Text style={styles.sigLine}>Date</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${d.providerEntity} — Pet Waste Removal Service Agreement · Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

/** Build the PDF and trigger a real file download in the browser. */
export async function downloadContractPdf(d: ContractData): Promise<void> {
  const blob = await pdf(<ContractPdf d={d} />).toBlob();
  const slug = (d.clientLegalName || "community").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "community";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-service-agreement.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
