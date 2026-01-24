import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SessionData {
  sessionId?: string;
  currentStep?: string;
  inServiceArea?: boolean;
  zip?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  dogCount?: number;
  frequency?: string;
  pricingSnapshot?: Record<string, unknown>;
  selectedPlanSnapshot?: Record<string, unknown>;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  referralCode?: string;
}

// POST: Create or update an onboarding session
export async function POST(request: NextRequest) {
  try {
    const body: SessionData = await request.json();
    const supabase = await createClient();

    // Get the default organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "doogoodscoopers")
      .single<{ id: string }>();

    if (orgError || !org) {
      console.error("Failed to get organization:", orgError);
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // If sessionId provided, update existing session
    if (body.sessionId) {
      const updateData: Record<string, unknown> = {
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (body.currentStep !== undefined) updateData.current_step = body.currentStep;
      if (body.inServiceArea !== undefined) updateData.in_service_area = body.inServiceArea;
      if (body.zip !== undefined) updateData.zip = body.zip;
      if (body.contactName !== undefined) updateData.contact_name = body.contactName;
      if (body.contactEmail !== undefined) updateData.contact_email = body.contactEmail;
      if (body.contactPhone !== undefined) updateData.contact_phone = body.contactPhone;
      if (body.address !== undefined) updateData.address = body.address;
      if (body.dogCount !== undefined) updateData.dog_count = body.dogCount;
      if (body.frequency !== undefined) updateData.frequency = body.frequency;
      if (body.pricingSnapshot !== undefined) updateData.pricing_snapshot = body.pricingSnapshot;
      if (body.selectedPlanSnapshot !== undefined) updateData.selected_plan_snapshot = body.selectedPlanSnapshot;
      if (body.utm !== undefined) updateData.utm = body.utm;
      if (body.referralCode !== undefined) updateData.referral_code = body.referralCode;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: session, error: updateError } = await (supabase as any)
        .from("onboarding_sessions")
        .update(updateData)
        .eq("id", body.sessionId)
        .eq("org_id", org.id)
        .select("id, current_step, status")
        .single() as { data: { id: string; current_step: string; status: string } | null; error: Error | null };

      if (updateError || !session) {
        console.error("Failed to update session:", updateError);
        return NextResponse.json(
          { error: "Failed to update session" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        sessionId: session.id,
        currentStep: session.current_step,
        status: session.status,
      });
    }

    // Create new session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: createError } = await (supabase as any)
      .from("onboarding_sessions")
      .insert({
        org_id: org.id,
        status: "IN_PROGRESS",
        current_step: body.currentStep || "zip",
        in_service_area: body.inServiceArea,
        zip: body.zip,
        contact_name: body.contactName,
        contact_email: body.contactEmail,
        contact_phone: body.contactPhone,
        address: body.address || {},
        pricing_snapshot: body.pricingSnapshot || {},
        selected_plan_snapshot: body.selectedPlanSnapshot || {},
        dog_count: body.dogCount,
        frequency: body.frequency,
        utm: body.utm || {},
        referral_code: body.referralCode,
        last_activity_at: new Date().toISOString(),
      })
      .select("id, current_step, status")
      .single() as { data: { id: string; current_step: string; status: string } | null; error: Error | null };

    if (createError || !session) {
      console.error("Failed to create session:", createError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Log the session start event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("onboarding_events").insert({
      org_id: org.id,
      session_id: session.id,
      event_type: "SESSION_STARTED",
      step: "zip",
      payload: {
        utm: body.utm,
        referralCode: body.referralCode,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      currentStep: session.current_step,
      status: session.status,
    });
  } catch (error) {
    console.error("Error managing onboarding session:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

// PUT: Mark session as completed
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, convertedClientId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      status: status || "COMPLETED",
      updated_at: new Date().toISOString(),
    };

    if (convertedClientId) {
      updateData.converted_client_id = convertedClientId;
    }

    if (status === "ABANDONED") {
      updateData.abandoned_at = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("onboarding_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      console.error("Failed to update session status:", error);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating session status:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

// GET: Retrieve session by ID
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
    const { data: session, error } = await (supabase as any)
      .from("onboarding_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) {
      console.error("Failed to get session:", error);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
