// Print-only legal service agreement rendered from the Community Quote inputs.
// Uses inline styles so the printed PDF is consistent regardless of Tailwind.

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
  // service + money (pre-formatted strings)
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

const S = {
  page: { fontFamily: "Georgia, 'Times New Roman', serif", color: "#111", fontSize: "11pt", lineHeight: 1.5, background: "#fff" } as React.CSSProperties,
  h1: { fontSize: "16pt", fontWeight: 700, textAlign: "center" as const, margin: "0 0 4pt", letterSpacing: "0.02em" },
  intro: { margin: "0 0 14pt", textAlign: "justify" as const },
  h2: { fontSize: "11.5pt", fontWeight: 700, textTransform: "uppercase" as const, margin: "14pt 0 5pt", borderBottom: "1px solid #999", paddingBottom: "2pt", breakAfter: "avoid" as const },
  h3: { fontSize: "11pt", fontWeight: 700, fontStyle: "italic" as const, margin: "8pt 0 3pt" },
  p: { margin: "0 0 7pt", textAlign: "justify" as const, breakInside: "avoid" as const },
  li: { margin: "0 0 4pt", textAlign: "justify" as const },
  sec: { breakInside: "avoid" as const } as React.CSSProperties,
};

export function ContractDocument({ d }: { d: ContractData }) {
  const term = blank(d.termMonths);
  const net = blank(d.netDays);
  const late = blank(d.lateFeePct);
  const state = d.governingState?.trim() || "California";
  const eff = fmtDate(d.effectiveDate);

  return (
    <div className="dgs-print-only">
      <div style={S.page}>
        <h1 style={S.h1}>Pet Waste Removal Service Agreement</h1>
        <p style={{ textAlign: "center", margin: "0 0 16pt", fontSize: "10pt", color: "#444" }}>
          {d.providerEntity} &nbsp;•&nbsp; {d.providerPhone}
        </p>

        <p style={S.intro}>
          This Pet Waste Removal Service Agreement (this &ldquo;Agreement&rdquo;) is entered into as of {eff} by
          and between {blank(d.providerEntity)} (&ldquo;Provider&rdquo;) and {blank(d.clientLegalName)}{" "}
          (&ldquo;Client&rdquo;), for services performed at {blank(d.propertyAddress)} (the &ldquo;Property&rdquo;).
          Provider and Client are each a &ldquo;Party&rdquo; and together the &ldquo;Parties.&rdquo;
        </p>

        {/* 1 */}
        <section style={S.sec}>
          <h2 style={S.h2}>1. Description of Services</h2>
          <p style={S.p}>
            Provider agrees to furnish professional dog-waste-removal (&ldquo;pet waste&rdquo;) services for the common
            areas and designated pet-relief areas of the Property, as further described below. Provider shall supply all
            labor, equipment, collection bags, and disposal necessary to perform the Services.
          </p>
          <h3 style={S.h3}>1.1 Service Details</h3>
          <p style={S.p}>
            The Services consist of the systematic inspection and removal of pet waste from approximately {blank(d.acres)}{" "}
            acre(s) of serviceable common area at the Property, performed {d.freq} time(s) per week (approximately{" "}
            {d.visitsMo} service visits per month).
            {d.stations > 0
              ? ` Provider shall also service ${d.stations} pet-waste station(s) at the Property, including restocking waste bags and emptying receptacles.`
              : ""}{" "}
            All collected waste shall be removed from the Property and disposed of in accordance with applicable law.
            Services are performed during normal daylight hours; specific service days may be adjusted by Provider for
            weather, holidays, or scheduling, with reasonable notice to Client. This Agreement covers common areas only
            and does not include private patios, yards, balconies, or interior spaces unless separately agreed in writing.
          </p>
        </section>

        {/* 2 */}
        <section style={S.sec}>
          <h2 style={S.h2}>2. Payment</h2>
          <h3 style={S.h3}>2.1 Payment Terms</h3>
          <p style={S.p}>
            The recurring service fee is {blank(d.monthlyTotal)} per month ({blank(d.perUnitMo)} per unit per month across{" "}
            {blank(d.units)} units).
            {d.hasOneTime
              ? ` A one-time start-up fee of ${d.oneTime}, covering initial cleanup and/or station installation, is due upon execution of this Agreement.`
              : ""}{" "}
            Provider will invoice Client monthly, and payment is due within {net} days of the invoice date. Any amount not
            paid when due shall accrue a late charge of {late}% per month (or the maximum rate permitted by law, if lower)
            on the outstanding balance. Provider may adjust the fees upon at least thirty (30) days&rsquo; prior written
            notice, or sooner upon a material change in the scope, serviceable area, or dog population at the Property.
            Client is responsible for any returned-payment fees and the reasonable costs of collection.
          </p>
        </section>

        {/* 3 */}
        <section style={S.sec}>
          <h2 style={S.h2}>3. Warranties</h2>
          <p style={S.p}>
            Provider warrants that the Services will be performed in a professional and workmanlike manner consistent with
            industry standards. EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, PROVIDER MAKES NO OTHER WARRANTIES, EXPRESS
            OR IMPLIED, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Provider does
            not warrant that the Property will remain free of pet waste between scheduled service visits. Client represents
            and warrants that it has full authority to enter into this Agreement and to grant Provider access to the
            Property, and that all animals at the Property are properly vaccinated and restrained during service visits.
          </p>
        </section>

        {/* 4 */}
        <section style={S.sec}>
          <h2 style={S.h2}>4. Term</h2>
          <p style={S.p}>
            This Agreement begins on the Effective Date and continues for an initial term of {term} months. Thereafter, it
            renews automatically for successive month-to-month periods unless either Party gives at least thirty (30)
            days&rsquo; prior written notice of non-renewal or termination. Either Party may terminate for convenience upon
            thirty (30) days&rsquo; written notice. Termination does not relieve Client of the obligation to pay for
            Services rendered through the effective date of termination.
          </p>
        </section>

        {/* 5 */}
        <section style={S.sec}>
          <h2 style={S.h2}>5. Default</h2>
          <p style={S.p}>The occurrence of any of the following shall constitute a material default under this Agreement:</p>
          <div style={{ paddingLeft: "18pt" }}>
            <p style={S.li}>(a) Failure to make any payment when due that remains uncured for ten (10) days after written notice;</p>
            <p style={S.li}>(b) Failure to perform or observe any material obligation under this Agreement that remains uncured for fifteen (15) days after written notice;</p>
            <p style={S.li}>(c) Denial of safe and reasonable access to the Property required to perform the Services;</p>
            <p style={S.li}>(d) The insolvency or bankruptcy of, or an assignment for the benefit of creditors by, either Party; or</p>
            <p style={S.li}>(e) Any material misrepresentation made by either Party in connection with this Agreement.</p>
          </div>
        </section>

        {/* 6 */}
        <section style={S.sec}>
          <h2 style={S.h2}>6. Remedies on Default</h2>
          <p style={S.p}>
            Upon a material default that remains uncured beyond the applicable cure period, the non-defaulting Party may, in
            addition to any other remedy available at law or in equity: (a) suspend its performance under this Agreement;
            (b) terminate this Agreement immediately upon written notice; and (c) recover all amounts then due and owing,
            together with interest and the reasonable costs of collection, including reasonable attorneys&rsquo; fees. All
            remedies are cumulative and not exclusive. In no event shall either Party be liable for indirect, incidental,
            special, or consequential damages.
          </p>
        </section>

        {/* 7 */}
        <section style={S.sec}>
          <h2 style={S.h2}>7. Dispute Resolution</h2>
          <p style={S.p}>
            This Agreement shall be governed by the laws of the State of {state}, without regard to its conflict-of-laws
            principles. The Parties shall first attempt in good faith to resolve any dispute through direct negotiation. If
            the dispute is not resolved within thirty (30) days, the Parties agree to submit it to non-binding mediation,
            sharing the mediator&rsquo;s fees equally. Any dispute not resolved by mediation may be brought in the state or
            federal courts located in {state}, or, at either Party&rsquo;s election for amounts within its jurisdiction, in
            small claims court. The prevailing Party shall be entitled to recover its reasonable attorneys&rsquo; fees and
            costs.
          </p>
        </section>

        {/* 8 */}
        <section style={S.sec}>
          <h2 style={S.h2}>8. Confidentiality</h2>
          <p style={S.p}>
            Each Party may have access to non-public information of the other, including pricing, resident information, and
            business operations (&ldquo;Confidential Information&rdquo;). Each Party agrees to use the other&rsquo;s
            Confidential Information solely to perform this Agreement and to protect it with at least reasonable care. This
            obligation survives termination for two (2) years. It does not apply to information that is or becomes public
            through no fault of the receiving Party, is independently developed, or is required to be disclosed by law.
          </p>
        </section>

        {/* 9 */}
        <section style={S.sec}>
          <h2 style={S.h2}>9. Notice</h2>
          <p style={S.p}>
            All notices under this Agreement shall be in writing and delivered by hand, by email with confirmation of
            receipt, or by nationally recognized courier, to the addresses below (or as updated by written notice):
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "4pt 0 6pt" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", verticalAlign: "top", paddingRight: "12pt" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Provider</p>
                  <p style={{ margin: 0 }}>{blank(d.providerEntity)}</p>
                  <p style={{ margin: 0 }}>{blank(d.providerAddress)}</p>
                  <p style={{ margin: 0 }}>{blank(d.providerPhone)}</p>
                  <p style={{ margin: 0 }}>{blank(d.providerEmail)}</p>
                </td>
                <td style={{ width: "50%", verticalAlign: "top" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Client</p>
                  <p style={{ margin: 0 }}>{blank(d.clientLegalName)}</p>
                  <p style={{ margin: 0 }}>{blank(d.propertyAddress)}</p>
                  <p style={{ margin: 0 }}>Attn: {blank(d.clientContact)}</p>
                  <p style={{ margin: 0 }}>{blank(d.clientEmail)}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Signatures */}
        <section style={{ ...S.sec, marginTop: "18pt" }}>
          <p style={{ margin: "0 0 10pt" }}>
            IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16pt" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", verticalAlign: "top", paddingRight: "18pt" }}>
                  <p style={{ margin: "18pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Provider signature</p>
                  <p style={{ margin: "2pt 0 0" }}>{blank(d.providerEntity)}</p>
                  <p style={{ margin: "14pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Name / Title</p>
                  <p style={{ margin: "14pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Date</p>
                </td>
                <td style={{ width: "50%", verticalAlign: "top" }}>
                  <p style={{ margin: "18pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Client signature</p>
                  <p style={{ margin: "2pt 0 0" }}>{blank(d.clientLegalName)}</p>
                  <p style={{ margin: "14pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Name / Title</p>
                  <p style={{ margin: "14pt 0 0", borderTop: "1px solid #111", paddingTop: "3pt" }}>Date</p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
