import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";

/**
 * Career applications submitted on the WordPress site
 * (https://doogoodscoopers.com/careers/) land here.
 *
 * WordPress form plugins all shape their payloads differently — WPForms nests
 * under `fields`, Elementor under `form_fields`, Contact Form 7 uses `your-name`
 * / `your-email`, Gravity Forms uses `input_3`. So rather than demanding exact
 * keys (which is what /api/careers does for the in-app form), this flattens the
 * payload and matches field names loosely. Anything it can't map is preserved in
 * the application's notes instead of being dropped.
 */

const SECRET = process.env.CAREERS_WEBHOOK_SECRET;

export const dynamic = "force-dynamic";

type Flat = Record<string, string>;

/** Flatten one level of nesting and stringify every leaf. */
function flatten(input: unknown, prefix = "", out: Flat = {}): Flat {
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      // WPForms sends { fields: { "1": { name, value } } }
      const o = v as Record<string, unknown>;
      if (typeof o.value === "string" || typeof o.value === "number") {
        const label = String(o.name ?? o.label ?? key);
        out[label] = String(o.value);
      } else {
        flatten(v, key, out);
      }
    } else if (Array.isArray(v)) {
      out[key] = v.map((x) => String(x)).join(", ");
    } else if (v !== null && v !== undefined) {
      out[key] = String(v);
    }
  }
  return out;
}

/** First value whose KEY loosely matches any pattern. */
function pick(flat: Flat, patterns: RegExp[]): string {
  for (const p of patterns) {
    for (const [k, v] of Object.entries(flat)) {
      if (p.test(k.toLowerCase().replace(/[\s_-]+/g, "")) && String(v).trim()) return String(v).trim();
    }
  }
  return "";
}

const yes = (v: string) => /^(1|y|yes|true|on|checked)$/i.test(v.trim());

export async function POST(request: NextRequest) {
  // Secret is optional (matching the Zapier webhook), but enforced once set.
  // Accepted as a Bearer header OR ?key= , since many WP form plugins cannot
  // add custom headers.
  if (SECRET) {
    const header = request.headers.get("authorization")?.replace("Bearer ", "");
    const qs = new URL(request.url).searchParams.get("key");
    if (header !== SECRET && qs !== SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // Accept JSON, urlencoded, or multipart — plugins differ.
  let raw: unknown = {};
  const ctype = request.headers.get("content-type") || "";
  try {
    if (ctype.includes("application/json")) {
      raw = await request.json();
    } else {
      const fd = await request.formData();
      const o: Record<string, string> = {};
      fd.forEach((v, k) => { o[k] = typeof v === "string" ? v : v.name; });
      raw = o;
    }
  } catch {
    return NextResponse.json({ success: false, error: "Unreadable payload" }, { status: 400 });
  }

  const flat = flatten(raw);

  // --- map the fields we care about ----------------------------------------
  let firstName = pick(flat, [/^firstname$/, /firstname/, /^fname$/]);
  let lastName = pick(flat, [/^lastname$/, /lastname/, /^lname$/, /surname/]);
  const fullName = pick(flat, [/^name$/, /^fullname$/, /yourname/, /applicantname/]);
  if ((!firstName || !lastName) && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = firstName || parts[0] || "";
    lastName = lastName || parts.slice(1).join(" ") || "";
  }

  const email = pick(flat, [/email/]);
  const phone = pick(flat, [/phone/, /^tel$/, /mobile/, /cell/]);

  if (!email && !phone) {
    return NextResponse.json({ success: false, error: "Need at least an email or phone" }, { status: 400 });
  }

  const address = pick(flat, [/^address$/, /street/, /address1/, /addressline/]);
  const city = pick(flat, [/^city$/, /town/]);
  const dateOfBirth = pick(flat, [/dob/, /dateofbirth/, /birth/]);
  const driversLicense = pick(flat, [/license/, /licence/, /^dl$/]);
  const ssnLast4 = pick(flat, [/ssn/, /social/]);
  const references = pick(flat, [/reference/]);
  const currentEmployment = pick(flat, [/currentemploy/, /employer/, /currentjob/]);
  const workDuties = pick(flat, [/duties/, /responsibilit/]);
  const whyLeftPrevious = pick(flat, [/whyleft/, /reasonforleaving/, /leaving/]);
  const previousBossContact = pick(flat, [/previousboss/, /formersupervisor/, /supervisor/]);
  const whyWorkHere = pick(flat, [/whywork/, /whyhere/, /whyjoin/, /tellus/, /message/, /comment/]);

  // Anything not mapped is still worth keeping — recruiters read it.
  const mappedValues = new Set(
    [firstName, lastName, fullName, email, phone, address, city, dateOfBirth, driversLicense,
      ssnLast4, references, currentEmployment, workDuties, whyLeftPrevious, previousBossContact, whyWorkHere]
      .filter(Boolean)
  );
  const extras = Object.entries(flat)
    .filter(([k, v]) => v.trim() && !mappedValues.has(v.trim()) && !/^(key|_wpnonce|action|form_id|post_id|referrer|page_url|user_agent|remote_ip)$/i.test(k))
    .map(([k, v]) => `${k}: ${v}`);

  const noteLines = ["Submitted via doogoodscoopers.com/careers"];
  if (extras.length) noteLines.push("", "Additional form fields:", ...extras);

  try {
    const app = await prisma.careerApplication.create({
      data: {
        // These columns are NOT NULL in the schema, so missing values become "".
        firstName: firstName || fullName || "Applicant",
        lastName: lastName || "",
        email: email || "",
        phone: phone || "",
        address: address || "",
        city: city || "",
        dateOfBirth: dateOfBirth || null,
        driversLicense: driversLicense || null,
        ssnLast4: ssnLast4 || null,
        legalCitizen: yes(pick(flat, [/citizen/, /legallyauthorized/, /eligibletowork/])),
        hasAutoInsurance: yes(pick(flat, [/insurance/])),
        convictedFelony: yes(pick(flat, [/felony/, /convicted/])),
        mayContactEmployers: yes(pick(flat, [/contactemployer/, /maycontact/])),
        references: references || null,
        currentEmployment: currentEmployment || null,
        workDuties: workDuties || null,
        whyLeftPrevious: whyLeftPrevious || null,
        previousBossContact: previousBossContact || null,
        whyWorkHere: whyWorkHere || null,
        notes: noteLines.join("\n"),
      },
      select: { id: true, firstName: true, lastName: true },
    });

    await notify({
      type: "lead_created",
      severity: "info",
      title: "📋 New career application",
      body: `${[app.firstName, app.lastName].filter(Boolean).join(" ") || "Applicant"}${city ? ` — ${city}` : ""}`,
      link: `/admin/careers/${app.id}`,
      push: true,
    }).catch(() => {});

    return NextResponse.json({ success: true, id: app.id });
  } catch (e) {
    console.error("[careers webhook] create failed:", e);
    return NextResponse.json({ success: false, error: "Could not save application" }, { status: 500 });
  }
}

// Some plugins ping the URL first to check it exists.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "careers webhook", expects: "POST" });
}
