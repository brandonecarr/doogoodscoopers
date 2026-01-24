import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface EventData {
  sessionId: string;
  eventType: string;
  step?: string;
  payload?: Record<string, unknown>;
}

// Valid event types
const validEventTypes = [
  "SESSION_STARTED",
  "STEP_VIEWED",
  "STEP_COMPLETED",
  "ZIP_CHECKED",
  "ZIP_IN_SERVICE",
  "ZIP_OUT_OF_SERVICE",
  "PRICING_VIEWED",
  "CONTACT_SUBMITTED",
  "DOGS_SUBMITTED",
  "NOTIFICATIONS_CONFIGURED",
  "PAYMENT_STARTED",
  "PAYMENT_COMPLETED",
  "PAYMENT_FAILED",
  "REVIEW_VIEWED",
  "SUBMISSION_STARTED",
  "SUBMISSION_COMPLETED",
  "SUBMISSION_FAILED",
  "SESSION_ABANDONED",
  "SESSION_RESUMED",
];

// POST: Log an onboarding event
export async function POST(request: NextRequest) {
  try {
    const body: EventData = await request.json();
    const { sessionId, eventType, step, payload } = body;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (!eventType) {
      return NextResponse.json(
        { error: "eventType is required" },
        { status: 400 }
      );
    }

    // Validate event type
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the session to verify it exists and get org_id
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("id, org_id, current_step")
      .eq("id", sessionId)
      .single<{ id: string; org_id: string; current_step: string }>();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Insert the event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error: eventError } = await (supabase as any)
      .from("onboarding_events")
      .insert({
        org_id: session.org_id,
        session_id: sessionId,
        event_type: eventType,
        step: step || session.current_step,
        payload: payload || {},
      })
      .select("id, event_type, step, created_at")
      .single() as { data: { id: string; event_type: string; step: string; created_at: string } | null; error: Error | null };

    if (eventError || !event) {
      console.error("Failed to log event:", eventError);
      return NextResponse.json(
        { error: "Failed to log event" },
        { status: 500 }
      );
    }

    // Update session's last_activity_at and current_step if step changed
    const updateData: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
    };

    // Update current step for step-related events
    if (step && (eventType === "STEP_VIEWED" || eventType === "STEP_COMPLETED")) {
      updateData.current_step = step;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("onboarding_sessions")
      .update(updateData)
      .eq("id", sessionId);

    return NextResponse.json({
      success: true,
      eventId: event.id,
      eventType: event.event_type,
      step: event.step,
      timestamp: event.created_at,
    });
  } catch (error) {
    console.error("Error logging onboarding event:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

// GET: Get events for a session (for analytics/debugging)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error } = await (supabase as any)
      .from("onboarding_events")
      .select("id, event_type, step, payload, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to get events:", error);
      return NextResponse.json(
        { error: "Failed to get events" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Error getting events:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
