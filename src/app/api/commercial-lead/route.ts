import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncContactToQuo } from "@/lib/quo";
import { flatten, makePicker, readPayload, secretOk } from "@/lib/form-payload";
import { notify } from "@/lib/notify";

/**
 * Commercial inquiry intake.
 *
 * Two senders land here:
 *   1. The in-app commercial form, posting JSON:
 *      { name, propertyName, phone, email, city, state, zipCode, notes }
 *   2. The Elementor form on https://doogoodscoopers.com/commercial-services/
 *      (form_id 6d489d82), posting urlencoded `form_fields[...]`:
 *      name, property_name, phone, email, city, zip, questions, and a privacy
 *      checkbox. It has NO state field.
 *
 * The previous version read JSON only, required exact camelCase keys, and
 * required `state`, so every submission from the website form was rejected with
 * a 400 and never became a lead. Fields are now matched loosely by key (see
 * form-payload.ts), and state defaults to CA — every city we serve is in it.
 */

const SECRET = process.env.COMMERCIAL_WEBHOOK_SECRET; // optional; enforced once set

export async function POST(request: Request) {
  if (!secretOk(request, SECRET)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await readPayload(request);
  } catch {
    return NextResponse.json({ success: false, message: "Unreadable payload" }, { status: 400 });
  }

  const flat = flatten(raw);
  const { pick } = makePicker(flat);

  // Order matters: the specific key first, then looser fallbacks.
  const propertyName = pick([/^propertyname$/, /property/, /^company$/, /business/, /hoa/, /communit/]);
  const name = pick([/^name$/, /^fullname$/, /contactname/, /yourname/, /^contact$/]);
  const email = pick([/^email$/, /email/]);
  const phone = pick([/^phone$/, /phonenumber/, /^phone/, /mobile/, /cell/, /^tel/]);
  const city = pick([/^city$/, /town/]);
  const zipCode = pick([/^zipcode$/, /^zip$/, /zip/, /postal/]);
  const state = pick([/^state$/]) || "CA";
  const inquiry = pick([/^notes$/, /^questions$/, /question/, /message/, /comment/, /inquiry/, /details/]);

  const missing = Object.entries({ name, propertyName, phone, email, city, zipCode })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.warn("[commercial-lead] rejected: missing", missing, "keys seen:", Object.keys(flat));
    return NextResponse.json(
      { success: false, message: `Missing required field: ${missing[0]}`, missing },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.commercialLead.create({
      data: { contactName: name, propertyName, email, phone, city, state, zipCode, inquiry: inquiry || null },
    });

    // The bell in the admin header plus a push to the owner's phone — the same
    // path every other lead type uses. The WEBHOOK_URL email below is a legacy
    // hook that is not configured, which is why commercial inquiries arrived
    // silently before this.
    await notify({
      type: "lead_created",
      severity: "info",
      title: "🏢 New commercial inquiry",
      body: `${propertyName} — ${name}, ${city} ${zipCode}`,
      link: `/admin/leads/commercial/${lead.id}`,
      push: true,
    }).catch(() => {});

    syncContactToQuo({
      externalId: `commerciallead:${lead.id}`,
      firstName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      company: lead.propertyName,
      source: "DooGoodScoopers Commercial",
    });

    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      const text = [
        "New Commercial Service Inquiry!", "",
        "CONTACT INFORMATION", "-------------------",
        `Name: ${name}`, `Property: ${propertyName}`, `Email: ${email}`, `Phone: ${phone}`, "",
        "LOCATION", "--------", `City: ${city}`, `State: ${state}`, `ZIP: ${zipCode}`,
        ...(inquiry ? ["", "ADDITIONAL NOTES", "----------------", inquiry] : []),
      ].join("\n");
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: process.env.NOTIFICATION_EMAIL || "service@doogoodscoopers.com",
            subject: `New Commercial Inquiry: ${propertyName}`,
            text,
          }),
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your inquiry has been submitted. We'll be in touch soon!",
      leadId: lead.id,
    });
  } catch (error) {
    console.error("Commercial lead submission error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit inquiry. Please try again." },
      { status: 500 }
    );
  }
}
