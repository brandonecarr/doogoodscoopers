import { NextRequest, NextResponse } from "next/server";
import {
  sendQuoteConfirmationEmail,
  sendQuoteNotificationEmail,
  QuoteEmailData,
} from "@/lib/email";

/**
 * Webhook endpoint for Sweep&Go callbacks
 * URL: https://doogoodscoopers.com/api/webhooks/sweepandgo
 *
 * Supported Events:
 * - free:quote - Triggered when a customer submits a free quote request
 *
 * For local development, use ngrok:
 * 1. Run: ngrok http 3000
 * 2. Use the ngrok URL in Sweep&Go webhook settings
 *
 * Environment Variables Required:
 * - SMTP_HOST: SMTP server hostname (default: smtp.gmail.com)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use TLS (default: false)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password or app-specific password
 * - SMTP_FROM: From email address (optional)
 * - SMTP_FROM_NAME: From name (optional)
 * - NOTIFY_EMAIL: Email to receive notifications (optional)
 */

// Webhook payload structure (flexible to accommodate various Sweep&Go formats)
interface SweepAndGoWebhookPayload {
  event?: string;
  type?: string;
  data?: {
    // Customer info
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    phone?: string;
    phone_numbers?: string[];
    // Address info
    zip_code?: string;
    zipCode?: string;
    address?: string;
    home_address?: string;
    city?: string;
    state?: string;
    // Service info
    number_of_dogs?: number | string;
    numberOfDogs?: number | string;
    frequency?: string;
    clean_up_frequency?: string;
    // Quote info
    quote_amount?: number | string;
    quoteAmount?: number | string;
    price?: number | string;
  };
  // Some webhooks may have data at root level
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body: SweepAndGoWebhookPayload = await request.json();

    // Log the webhook payload for debugging
    console.log("Sweep&Go Webhook received:", JSON.stringify(body, null, 2));

    // Extract event type from the payload
    const eventType = body.event || body.type || "unknown";

    // Handle different webhook events
    switch (eventType) {
      case "free:quote":
        await handleFreeQuote(body);
        break;

      case "quote_created":
        console.log("New quote created:", body.data);
        await handleFreeQuote(body);
        break;

      case "client_onboarded":
        console.log("New client onboarded:", body.data);
        break;

      case "payment_received":
        console.log("Payment received:", body.data);
        break;

      case "lead_captured":
      case "lead:in_service_area":
        console.log("Lead captured:", body.data);
        await handleFreeQuote(body);
        break;

      default:
        console.log("Unknown webhook event:", eventType, body);
        // Try to handle as a quote if it has customer data
        if (hasCustomerData(body)) {
          await handleFreeQuote(body);
        }
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

/**
 * Handle free:quote webhook event
 * Extracts customer data and sends branded confirmation email
 */
async function handleFreeQuote(payload: SweepAndGoWebhookPayload): Promise<void> {
  const data = payload.data;

  // Extract customer name (try various field formats)
  const firstName = data?.first_name || payload.first_name || "";
  const lastName = data?.last_name || payload.last_name || "";
  const fullName = data?.name || `${firstName} ${lastName}`.trim() || "Valued Customer";

  // Extract email
  const email = data?.email || payload.email;

  if (!email) {
    console.log("No email address in webhook payload. Skipping email send.");
    return;
  }

  // Extract phone (try various formats)
  const phone = data?.phone ||
    (data?.phone_numbers && data.phone_numbers[0]) ||
    "";

  // Build email data from payload
  const emailData: QuoteEmailData = {
    customerName: fullName,
    email: email,
    phone: phone,
    zipCode: data?.zip_code || data?.zipCode || "",
    numberOfDogs: data?.number_of_dogs || data?.numberOfDogs || "",
    frequency: data?.frequency || data?.clean_up_frequency || "",
    quoteAmount: data?.quote_amount || data?.quoteAmount || data?.price || "",
    address: data?.address || data?.home_address || "",
    city: data?.city || "",
    state: data?.state || "",
  };

  console.log("Processing free:quote for:", emailData.email);

  // Send branded confirmation email to customer
  const customerEmailSent = await sendQuoteConfirmationEmail(emailData);
  console.log(`Customer email ${customerEmailSent ? "sent" : "not sent"}`);

  // Send notification to business owner
  const notificationSent = await sendQuoteNotificationEmail(emailData);
  console.log(`Notification email ${notificationSent ? "sent" : "not sent"}`);
}

/**
 * Check if payload contains customer data (for unknown event types)
 */
function hasCustomerData(payload: SweepAndGoWebhookPayload): boolean {
  return !!(payload.data?.email || payload.email);
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
