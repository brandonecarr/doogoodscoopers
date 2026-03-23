import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAdminPush } from "@/lib/web-push";

// Sweep&Go Webhook — receives quote and lead events
//
// SETUP INSTRUCTIONS:
// 1. Add your Vercel URL to env: NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
// 2. Add a secret env var: SWEEPANDGO_WEBHOOK_SECRET=some-random-string
// 3. In Sweep&Go dashboard (or via API), generate an access token:
//    POST https://openapi.sweepandgo.com/api/token_generate/access_token
//    {
//      "organization_id": <your_org_id>,
//      "webhooks_url": "https://your-app.vercel.app/api/webhooks/sweepandgo",
//      "enabled_events": ["free:quote", "lead:in_service_area", "lead:out_of_service_area"],
//      "description": "DooGoodScoopers lead intake"
//    }
//
// Events handled:
//   free:quote              → creates QuoteLead
//   lead:in_service_area    → creates QuoteLead
//   lead:out_of_service_area → creates OutOfAreaLead (if all required fields present)
//
// Sweep&Go typical payload shape:
// {
//   "event": "free:quote",
//   "data": {
//     "name": "Jane Smith",
//     "first_name": "Jane",
//     "last_name": "Smith",
//     "email": "jane@example.com",
//     "phone": "6265551234",
//     "home_phone": "...",
//     "address": "123 Main St",
//     "city": "Rancho Cucamonga",
//     "state": "CA",
//     "zip_code": "91730",
//     ...any additional fields from the quote form
//   }
// }

const WEBHOOK_SECRET = process.env.SWEEPANDGO_WEBHOOK_SECRET;

function parseName(data: Record<string, unknown>) {
  // Try every common Sweep&Go / API field name variation
  const firstName =
    (data.first_name as string) ||
    (data.firstName as string) ||
    (data.fname as string) ||
    null;

  const lastName =
    (data.last_name as string) ||
    (data.lastName as string) ||
    (data.lname as string) ||
    null;

  const fullName =
    (data.name as string) ||
    (data.full_name as string) ||
    (data.fullName as string) ||
    (data.client_name as string) ||
    (data.contact_name as string) ||
    (data.customer_name as string) ||
    (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || null);

  // If only fullName available, split it into first/last
  if (fullName && !firstName) {
    const parts = fullName.trim().split(/\s+/);
    return {
      firstName: parts[0] || null,
      lastName: parts.slice(1).join(" ") || null,
      fullName,
    };
  }
  return { firstName, lastName, fullName };
}

function extractPhone(data: Record<string, unknown>): string | null {
  return (
    (data.phone as string) ||
    (data.cell_phone as string) ||
    (data.cellPhone as string) ||
    (data.home_phone as string) ||
    (data.homePhone as string) ||
    (data.phone_number as string) ||
    (data.phoneNumber as string) ||
    (data.mobile as string) ||
    null
  );
}

export async function POST(request: NextRequest) {
  try {
    // Optional secret check — supports both Authorization header and ?secret= query param
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("authorization");
      const headerSecret = authHeader?.replace("Bearer ", "").trim();
      const querySecret = new URL(request.url).searchParams.get("secret");
      if (headerSecret !== WEBHOOK_SECRET && querySecret !== WEBHOOK_SECRET) {
        console.error("[SweepAndGo] Invalid webhook secret");
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();

    // Sweep&Go wraps payload under `data`, but handle flat payloads too
    const event: string = body.event || "";
    const data: Record<string, unknown> = body.data ?? body;

    // Log the full raw payload so we can see exactly what Sweep&Go sends
    console.log(`[SweepAndGo] Event: ${event}`, JSON.stringify(body, null, 2));

    const { firstName, lastName, fullName } = parseName(data);
    const phone = extractPhone(data);
    const email = (data.email as string) || null;
    const address = (data.address as string) || null;
    const city = (data.city as string) || null;
    const state = (data.state as string) || null;
    const zipCode =
      (data.zip_code as string) ||
      (data.zip as string) ||
      (data.postal_code as string) ||
      null;

    // ── Out of area ───────────────────────────────────────────────────────────
    if (event === "lead:out_of_service_area") {
      if (!firstName || !email || !phone || !zipCode) {
        console.warn("[SweepAndGo] Out-of-area lead missing required fields, skipping");
        return NextResponse.json({ success: true, skipped: true });
      }

      const lead = await prisma.outOfAreaLead.create({
        data: {
          firstName,
          lastName: lastName || "",
          email,
          phone,
          zipCode,
        },
      });

      sendAdminPush({
        title: "📍 New Out-of-Area Lead",
        body: `${fullName || phone} — ${zipCode}`,
        url: `/admin/out-of-area/${lead.id}`,
        tag: `ooa-lead-${lead.id}`,
      }).catch(console.error);

      console.log(`[SweepAndGo] Out-of-area lead created: ${lead.id}`);
      return NextResponse.json({ success: true, lead_id: lead.id, type: "out_of_area" });
    }

    // ── Ignore all other event types ─────────────────────────────────────────
    if (event !== "free:quote" && event !== "lead:in_service_area" && event !== "") {
      console.log(`[SweepAndGo] Ignoring event type: ${event}`);
      return NextResponse.json({ success: true, ignored: true, event });
    }

    // ── Quote lead (free:quote or lead:in_service_area) ───────────────────────
    if (event === "free:quote" || event === "lead:in_service_area" || event === "") {
      const displayName = fullName || firstName || "Unknown";

      // Pull any extra fields not already mapped
      const knownFields = [
        "event", "name", "full_name", "first_name", "last_name",
        "email", "phone", "cell_phone", "home_phone", "phone_number",
        "address", "city", "state", "zip_code", "zip", "postal_code",
        "number_of_dogs", "num_dogs", "dogs",
        "frequency", "service_frequency",
        "notes", "message",
      ];
      const extraNotes: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (!knownFields.includes(key) && value != null && value !== "") {
          extraNotes.push(`${key}: ${value}`);
        }
      }

      // Combine any form notes + extra fields into the notes field
      const formNotes =
        (data.notes as string) || (data.message as string) || null;
      const notes = [formNotes, ...extraNotes].filter(Boolean).join("\n") || null;

      const lead = await prisma.quoteLead.create({
        data: {
          firstName: firstName || "Unknown",
          lastName: lastName || null,
          email,
          phone: phone || "",
          address: address || null,
          city: city || null,
          zipCode: zipCode || "",
          numberOfDogs:
            (data.number_of_dogs as string) ||
            (data.num_dogs as string) ||
            (data.dogs as string) ||
            null,
          frequency:
            (data.frequency as string) ||
            (data.service_frequency as string) ||
            null,
          notes,
          lastStep: "Sweep&Go Quote Form",
        },
      });

      sendAdminPush({
        title: "📋 New Quote Lead",
        body: `${displayName}${zipCode ? ` — ${zipCode}` : ""}`,
        url: `/admin/quote-leads/${lead.id}`,
        tag: `quote-lead-${lead.id}`,
      }).catch(console.error);

      console.log(`[SweepAndGo] Quote lead created: ${lead.id} — ${displayName}`);
      return NextResponse.json({ success: true, lead_id: lead.id, type: "quote" });
    }
  } catch (error) {
    console.error("[SweepAndGo] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: "Failed to process webhook" }, { status: 500 });
  }
}

// GET for health-check / verification
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Sweep&Go webhook endpoint is active",
    endpoint: "/api/webhooks/sweepandgo",
  });
}
