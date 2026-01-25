/**
 * Process Pending Notifications Cron
 *
 * Processes scheduled notifications that are due to be sent.
 * Should be called periodically (e.g., every 5 minutes).
 */

import { NextRequest, NextResponse } from "next/server";
import { processPendingNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingNotifications();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing notifications:", error);
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    );
  }
}

// Also allow POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
