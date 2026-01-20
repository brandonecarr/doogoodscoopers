import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook endpoint for Sweep&Go callbacks
 * URL: https://doogoodscoopers.com/api/webhooks/sweepandgo
 *
 * For local development, use ngrok:
 * 1. Run: ngrok http 3000
 * 2. Use the ngrok URL in Sweep&Go webhook settings
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log the webhook payload for debugging
    console.log("Sweep&Go Webhook received:", JSON.stringify(body, null, 2));

    // Extract event type from the payload
    const eventType = body.event || body.type || "unknown";

    // Handle different webhook events
    switch (eventType) {
      case "quote_created":
        console.log("New quote created:", body.data);
        // Handle new quote - could send notification, update database, etc.
        break;

      case "client_onboarded":
        console.log("New client onboarded:", body.data);
        // Handle successful client registration
        break;

      case "payment_received":
        console.log("Payment received:", body.data);
        // Handle payment confirmation
        break;

      case "lead_captured":
        console.log("Lead captured (out of area):", body.data);
        // Handle out-of-area lead
        break;

      default:
        console.log("Unknown webhook event:", eventType, body);
    }

    // Always return 200 OK to acknowledge receipt
    // Sweep&Go may retry if it doesn't receive a 2xx response
    return NextResponse.json({
      success: true,
      message: "Webhook received",
      event: eventType,
    });

  } catch (error) {
    console.error("Webhook processing error:", error);

    // Still return 200 to prevent retries for malformed payloads
    // Log the error for investigation
    return NextResponse.json({
      success: false,
      message: "Webhook received but processing failed",
    });
  }
}

// Also handle GET requests for webhook verification (if Sweep&Go uses this)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  // If there's a challenge parameter, return it (common verification pattern)
  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    status: "Webhook endpoint active",
    endpoint: "/api/webhooks/sweepandgo",
  });
}
