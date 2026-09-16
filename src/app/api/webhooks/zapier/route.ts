import { NextRequest, NextResponse } from "next/server";
import { createAdLeadFromMeta, mapFlatLead } from "@/lib/ad-lead-intake";

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
    const res = await createAdLeadFromMeta(mapFlatLead(payload, { sourceLabel: "Zapier" }));
    return NextResponse.json({ success: true, lead_id: res.finalId, lead_type: res.finalType, message: "Lead saved successfully" });
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
