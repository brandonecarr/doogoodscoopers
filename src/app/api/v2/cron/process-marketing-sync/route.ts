/**
 * Marketing Sync Processing Cron
 *
 * Processes pending marketing sync events and sends data to integrations.
 * Should run every 5-15 minutes via external cron service.
 */

import { NextRequest, NextResponse } from "next/server";
import { processPendingSyncEvents } from "@/lib/marketing-sync";

/**
 * GET /api/v2/cron/process-marketing-sync
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await processPendingSyncEvents();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("Marketing sync cron error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal error",
    });
  }
}
