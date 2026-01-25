/**
 * Twilio Status Webhook
 *
 * Handle SMS delivery status callbacks from Twilio.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Map Twilio status to our status
const STATUS_MAP: Record<string, string> = {
  queued: "PENDING",
  sending: "PENDING",
  sent: "SENT",
  delivered: "DELIVERED",
  undelivered: "FAILED",
  failed: "FAILED",
};

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;
    const errorMessage = formData.get("ErrorMessage") as string | null;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const mappedStatus = STATUS_MAP[messageStatus] || messageStatus.toUpperCase();

    // Update notification status
    const updates: Record<string, unknown> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (mappedStatus === "DELIVERED") {
      updates.delivered_at = new Date().toISOString();
    }

    if (errorCode || errorMessage) {
      updates.error_message = errorMessage || `Error code: ${errorCode}`;
    }

    const { error } = await supabase
      .from("notifications")
      .update(updates)
      .eq("provider_id", messageSid);

    if (error) {
      console.error("Error updating notification status:", error);
    }

    // Also update any messages with this provider ID
    await supabase
      .from("messages")
      .update({
        status: mappedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_message_id", messageSid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Twilio status webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
