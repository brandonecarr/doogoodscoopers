import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Abandonment threshold in minutes
const ABANDONMENT_THRESHOLD_MINUTES = 30;

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)
// It marks onboarding sessions as ABANDONED if they've been idle for too long

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Calculate the threshold timestamp
    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - ABANDONMENT_THRESHOLD_MINUTES);
    const thresholdISO = thresholdDate.toISOString();

    // Find sessions that are IN_PROGRESS and haven't been updated recently
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staleSessions, error: fetchError } = await (supabase as any)
      .from("onboarding_sessions")
      .select("id, org_id, current_step, last_activity_at")
      .eq("status", "IN_PROGRESS")
      .lt("last_activity_at", thresholdISO)
      .limit(100); // Process in batches

    if (fetchError) {
      console.error("Failed to fetch stale sessions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch stale sessions" },
        { status: 500 }
      );
    }

    if (!staleSessions || staleSessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stale sessions to mark as abandoned",
        processed: 0,
      });
    }

    // Mark each session as abandoned and log the event
    let processedCount = 0;
    const errors: string[] = [];

    for (const session of staleSessions) {
      try {
        // Update session status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("onboarding_sessions")
          .update({
            status: "ABANDONED",
            abandoned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        if (updateError) {
          errors.push(`Failed to update session ${session.id}: ${updateError.message}`);
          continue;
        }

        // Log abandonment event
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("onboarding_events").insert({
          org_id: session.org_id,
          session_id: session.id,
          event_type: "SESSION_ABANDONED",
          step: session.current_step,
          payload: {
            last_activity_at: session.last_activity_at,
            abandoned_at: new Date().toISOString(),
            idle_minutes: ABANDONMENT_THRESHOLD_MINUTES,
          },
        });

        processedCount++;
      } catch (err) {
        errors.push(`Error processing session ${session.id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Marked ${processedCount} sessions as abandoned`,
      processed: processedCount,
      total: staleSessions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in mark-abandoned cron:", error);
    return NextResponse.json(
      { error: "An error occurred during abandonment processing" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
