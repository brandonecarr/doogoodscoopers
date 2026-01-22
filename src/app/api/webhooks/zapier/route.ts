import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Zapier Webhook endpoint to receive leads from Facebook Lead Ads
//
// Setup in Zapier:
// 1. Create a new Zap
// 2. Trigger: "Facebook Lead Ads" -> "New Lead"
// 3. Action: "Webhooks by Zapier" -> "POST"
// 4. URL: https://yourdomain.com/api/webhooks/zapier
// 5. Payload Type: JSON
// 6. Map the fields from Facebook to the payload (see expected format below)
//
// Expected payload format from Zapier:
// {
//   "name": "John Doe",           // or "first_name" and "last_name" separately
//   "first_name": "John",
//   "last_name": "Doe",
//   "email": "john@example.com",
//   "phone": "+16265551234",
//   "city": "Rancho Cucamonga",
//   "state": "CA",
//   "zip_code": "91730",
//   "ad_id": "123456789",
//   "ad_name": "Spring Cleanup Ad",
//   "adset_id": "987654321",
//   "adset_name": "Dog Owners 25-54",
//   "campaign_id": "111222333",
//   "campaign_name": "Spring 2024 Campaign",
//   "form_id": "444555666",
//   "form_name": "Get Free Quote",
//   "created_time": "2024-01-15T10:30:00Z",
//   ... any other fields from your lead form
// }

const WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "");

      if (providedSecret !== WEBHOOK_SECRET) {
        console.error("[Zapier Webhook] Invalid secret");
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const payload = await request.json();

    // Handle both combined name and separate first/last name
    let firstName = payload.first_name || null;
    let lastName = payload.last_name || null;
    let fullName = payload.name || payload.full_name || null;

    // If we have a combined name but no separate names, split it
    if (fullName && !firstName) {
      const nameParts = fullName.trim().split(/\s+/);
      firstName = nameParts[0] || null;
      lastName = nameParts.slice(1).join(" ") || null;
    }

    // If we have separate names but no full name, combine them
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(" ");
    }

    // Extract contact info
    const email = payload.email || null;
    const phone = payload.phone || payload.phone_number || null;

    // Extract location
    const city = payload.city || null;
    const state = payload.state || null;
    const zipCode = payload.zip_code || payload.zip || payload.postal_code || null;

    // Extract ad/campaign info
    const adSource = "meta"; // Coming from Facebook via Zapier
    const campaignName = payload.campaign_name || null;
    const adSetName = payload.adset_name || payload.ad_set_name || null;
    const adName = payload.ad_name || null;
    const formName = payload.form_name || null;

    // Store all fields for reference
    const customFields: Record<string, unknown> = {};
    const knownFields = [
      "name", "full_name", "first_name", "last_name", "email", "phone", "phone_number",
      "city", "state", "zip_code", "zip", "postal_code",
      "ad_id", "ad_name", "adset_id", "adset_name", "ad_set_name",
      "campaign_id", "campaign_name", "form_id", "form_name", "created_time"
    ];

    for (const [key, value] of Object.entries(payload)) {
      if (!knownFields.includes(key) && value !== null && value !== undefined && value !== "") {
        customFields[key] = value;
      }
    }

    // Create the lead
    const lead = await prisma.adLead.create({
      data: {
        firstName,
        lastName,
        fullName,
        email,
        phone,
        city,
        state,
        zipCode,
        adSource,
        campaignName,
        adSetName,
        adName,
        formName,
        customFields: Object.keys(customFields).length > 0
          ? (customFields as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        rawPayload: payload as Prisma.InputJsonValue,
      },
    });

    console.log(`[Zapier Webhook] New lead created: ${lead.id} - ${fullName || email || phone}`);

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      message: "Lead saved successfully",
    });
  } catch (error) {
    console.error("[Zapier Webhook] Error processing lead:", error);

    return NextResponse.json(
      { success: false, error: "Failed to process lead" },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/verification
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Zapier webhook endpoint is active",
    endpoint: "/api/webhooks/zapier",
    usage: "Configure this URL as a Webhook POST action in your Zap",
  });
}
