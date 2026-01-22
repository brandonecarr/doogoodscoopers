import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Privyr webhook endpoint to receive leads from Meta/Facebook ads
// Documentation: https://documenter.getpostman.com/view/7718817/2s93RXsW9Z
//
// NOTE: This is the RECEIVING endpoint - Privyr sends leads TO this URL
// The webhook URL you give to Privyr is: https://yourdomain.com/api/webhooks/privyr
//
// Privyr payload format:
// {
//   "name": "Tony Stark",           // Required
//   "email": "tony@avengers.com",   // Optional
//   "phone": "+16262223333",        // Optional
//   "display_name": "Tony",         // Optional
//   "other_fields": {               // Optional - any additional data
//     "Address": "...",
//     "income": "..."
//   }
// }

interface PrivyrPayload {
  name: string;
  email?: string;
  phone?: string;
  display_name?: string;
  other_fields?: Record<string, string | number | boolean>;
}

export async function POST(request: NextRequest) {
  try {
    const payload: PrivyrPayload = await request.json();

    // Validate required field
    if (!payload.name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // Parse the name into first/last
    const nameParts = payload.name.trim().split(/\s+/);
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(" ") || null;

    // Extract location from other_fields if present
    const otherFields = payload.other_fields || {};
    const city = (otherFields.city || otherFields.City || null) as string | null;
    const state = (otherFields.state || otherFields.State || null) as string | null;
    const zipCode = (otherFields.zip || otherFields.Zip || otherFields.zip_code || otherFields.postal_code || null) as string | null;

    // Extract ad/campaign info from other_fields if present
    const adSource = (otherFields.source || otherFields.ad_source || otherFields.platform || "meta") as string;
    const campaignName = (otherFields.campaign || otherFields.campaign_name || null) as string | null;
    const adSetName = (otherFields.adset || otherFields.adset_name || null) as string | null;
    const adName = (otherFields.ad || otherFields.ad_name || null) as string | null;
    const formName = (otherFields.form || otherFields.form_name || null) as string | null;

    // Create the lead
    const lead = await prisma.adLead.create({
      data: {
        firstName,
        lastName,
        fullName: payload.name,
        email: payload.email || null,
        phone: payload.phone || null,
        city,
        state,
        zipCode,
        adSource,
        campaignName,
        adSetName,
        adName,
        formName,
        customFields: Object.keys(otherFields).length > 0 ? (otherFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        rawPayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      },
    });

    console.log(`[Privyr Webhook] New lead created: ${lead.id} - ${payload.name}`);

    // Return response in Privyr's expected format
    return NextResponse.json({
      success: true,
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("[Privyr Webhook] Error processing lead:", error);

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
    message: "Privyr webhook endpoint is active",
    endpoint: "/api/webhooks/privyr",
    usage: "POST leads to this URL from Privyr",
  });
}
