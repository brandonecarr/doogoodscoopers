import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAdminPush } from "@/lib/web-push";
import { syncContactToQuo } from "@/lib/quo";

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
    (data.cell_phone_number as string) || // Sweep&Go free:quote payload
    (data.cellPhone as string) ||
    (data.home_phone as string) ||
    (data.homePhone as string) ||
    (data.phone_number as string) ||
    (data.phoneNumber as string) ||
    (data.mobile as string) ||
    null
  );
}

function extractEmail(data: Record<string, unknown>): string | null {
  return (
    (data.email as string) ||
    (data.your_email_address as string) || // Sweep&Go free:quote payload
    (data.email_address as string) ||
    null
  );
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json();

    // ── Auth ──────────────────────────────────────────────────────────────────
    // Sweep&Go does not document how it signs webhook deliveries, so gather every
    // place a shared secret/token could arrive, compare against WEBHOOK_SECRET,
    // and — for now — LOG the outcome instead of rejecting. This unblocks intake
    // and surfaces (in the Vercel function logs) exactly where SNG puts its token,
    // so we can flip back to strict rejection once we know the scheme.
    // We log only WHERE a candidate was found, never the secret value itself.
    const authHeaderRaw = request.headers.get("authorization") || "";
    const secretCandidates = [
      authHeaderRaw.replace(/^Bearer\s+/i, "").trim(),
      authHeaderRaw.trim(),
      url.searchParams.get("secret") || "",
      url.searchParams.get("token") || "",
      url.searchParams.get("access_token") || "",
      request.headers.get("x-sng-token") || "",
      request.headers.get("x-webhook-token") || "",
      request.headers.get("token") || "",
      (body?.access_token as string) || "",
      (body?.token as string) || "",
    ].filter(Boolean);

    const authLocations = {
      authorizationHeader: !!authHeaderRaw,
      querySecret: url.searchParams.has("secret"),
      queryToken: url.searchParams.has("token"),
      queryAccessToken: url.searchParams.has("access_token"),
      bodyAccessToken: body?.access_token != null,
      bodyToken: body?.token != null,
    };

    if (WEBHOOK_SECRET) {
      if (secretCandidates.includes(WEBHOOK_SECRET)) {
        console.log("[SweepAndGo] Webhook secret verified.");
      } else {
        console.warn(
          "[SweepAndGo] Secret NOT matched — processing anyway (temporary). Auth seen at:",
          JSON.stringify(authLocations)
        );
      }
    }

    // Sweep&Go wraps payload under `data`, but handle flat payloads too.
    // The event type may arrive as `event` or `type` (Sweep&Go uses `type`).
    const event: string = body.event || body.type || "";
    const data: Record<string, unknown> = body.data ?? body;

    // Log the full raw payload so we can see exactly what Sweep&Go sends
    console.log(`[SweepAndGo] Event: ${event}`, JSON.stringify(body, null, 2));

    const { firstName, lastName, fullName } = parseName(data);
    const phone = extractPhone(data);
    const email = extractEmail(data);
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

    // ── Ignore everything that isn't an explicit quote event ─────────────────
    // Only free:quote / lead:in_service_area create quote leads. An empty/unknown
    // event is NOT a quote (Sweep&Go fires job, payroll, notification, and client
    // events here too — those must never become leads). The API-poll cron
    // (/api/v2/cron/sync-sweepandgo) is the reliable source for quote leads.
    if (event !== "free:quote" && event !== "lead:in_service_area") {
      console.log(`[SweepAndGo] Ignoring event type: ${event || "(empty)"}`);
      return NextResponse.json({ success: true, ignored: true, event });
    }

    // ── Quote lead (free:quote or lead:in_service_area) ───────────────────────
    if (event === "free:quote" || event === "lead:in_service_area") {
      const displayName = fullName || firstName || "Unknown";

      // Pull any extra fields not already mapped
      const knownFields = [
        "event", "name", "full_name", "fullName", "first_name", "last_name",
        "firstName", "lastName", "fname", "lname",
        "email", "your_email_address", "email_address",
        "phone", "cell_phone", "cell_phone_number", "cellPhone",
        "home_phone", "homePhone", "phone_number", "phoneNumber", "mobile",
        "address", "city", "state", "zip_code", "zip", "postal_code",
        "number_of_dogs", "num_dogs", "dogs",
        "frequency", "clean_up_frequency", "service_frequency",
        "last_cleaned", "last_time_yard_was_thoroughly_cleaned",
        "marketing_allowed", "created_at",
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

      const leadData = {
        firstName: firstName || "Unknown",
        lastName: lastName || null,
        email,
        phone: phone || "",
        address: address || null,
        city: city || null,
        zipCode: zipCode || "",
        numberOfDogs:
          (data.number_of_dogs != null ? String(data.number_of_dogs) : null) ||
          (data.num_dogs as string) ||
          (data.dogs as string) ||
          null,
        frequency:
          (data.frequency as string) ||
          (data.clean_up_frequency as string) || // Sweep&Go free:quote payload
          (data.service_frequency as string) ||
          null,
        lastCleaned:
          (data.last_cleaned as string) ||
          (data.last_time_yard_was_thoroughly_cleaned as string) || // Sweep&Go free:quote payload
          null,
        notes,
        lastStep: "Sweep&Go Quote Form",
      };

      // Dedup: Sweep&Go delivers the SAME quote several times (and retries in
      // ~10-min batches). If we already have a recent, non-archived lead with
      // this phone, update it instead of creating another row — and only send a
      // push notification when it's genuinely new, so one quote = one alert.
      const hasPhone = (phone || "").replace(/\D/g, "").length >= 10;
      const existingLead = hasPhone
        ? await prisma.quoteLead.findFirst({
            where: {
              phone: phone as string,
              archived: false,
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

      if (existingLead) {
        // Enrich, never erase: the API-poll cron creates the lead fast without a
        // zip (the free_quotes API omits it); the webhook carries zip/address/
        // city, so fill those in — but keep whatever we already have if this
        // particular delivery is missing them.
        const lead = await prisma.quoteLead.update({
          where: { id: existingLead.id },
          data: {
            ...leadData,
            zipCode: zipCode || existingLead.zipCode || "",
            address: address || existingLead.address || null,
            city: city || existingLead.city || null,
            email: email || existingLead.email || null,
          },
        });
        syncContactToQuo({
          externalId: `quotelead:${lead.id}`,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          source: "DooGoodScoopers Quote",
        });
        console.log(`[SweepAndGo] Quote lead deduped/updated: ${lead.id} — ${displayName}`);
        return NextResponse.json({ success: true, lead_id: lead.id, type: "quote", deduped: true });
      }

      const lead = await prisma.quoteLead.create({ data: leadData });

      syncContactToQuo({
        externalId: `quotelead:${lead.id}`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        source: "DooGoodScoopers Quote",
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
