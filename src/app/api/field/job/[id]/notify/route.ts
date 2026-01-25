/**
 * Field Job Notify API
 *
 * Send "on the way" notification to client for a job.
 * Creates notification record and triggers SMS/email if enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";
import { sendClientNotification } from "@/lib/notifications";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Allowed roles for field operations
const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/field/job/[id]/notify
 * Send "on the way" notification
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { eta } = body; // Optional ETA in minutes

    // Get the job with client info
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_date,
        client:client_id (
          id,
          first_name,
          last_name,
          phone,
          email,
          notification_preferences
        ),
        location:location_id (
          id,
          address_line1,
          city
        )
      `)
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if job is in a valid state for notification
    if (!["SCHEDULED", "EN_ROUTE"].includes(job.status)) {
      return NextResponse.json(
        { error: "Cannot send notification for this job status" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = job.client as any;

    if (!client) {
      return NextResponse.json(
        { error: "No client associated with this job" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const location = job.location as any;

    // Get notification preferences
    const prefs = client.notification_preferences || {};
    const sendSms = prefs.sms_on_the_way !== false && client.phone;
    const sendEmail = prefs.email_on_the_way === true && client.email;

    if (!sendSms && !sendEmail) {
      return NextResponse.json({
        sent: false,
        message: "Client has no notification channels enabled",
        channels: [],
      });
    }

    // Build template variables
    const templateVars = {
      client_first_name: client.first_name || "there",
      client_name: `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Customer",
      eta_minutes: eta ? String(eta) : "",
      address: location?.address_line1 || "",
      city: location?.city || "",
    };

    const notificationsSent: string[] = [];

    // Send notifications using the notification service
    const results = await sendClientNotification({
      orgId: auth.user.orgId,
      clientId: client.id,
      jobId: id,
      type: "ON_THE_WAY",
      phone: sendSms ? client.phone : undefined,
      email: sendEmail ? client.email : undefined,
      variables: templateVars,
    });

    if (results.sms?.success) {
      notificationsSent.push("SMS");
    }
    if (results.email?.success) {
      notificationsSent.push("EMAIL");
    }

    // Update job status to EN_ROUTE if it was SCHEDULED
    if (job.status === "SCHEDULED") {
      await supabase
        .from("jobs")
        .update({
          status: "EN_ROUTE",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "JOB_NOTIFY_ON_THE_WAY",
      entity_type: "JOB",
      entity_id: id,
      details: {
        clientId: client.id,
        channels: notificationsSent,
        eta,
      },
    });

    return NextResponse.json({
      sent: notificationsSent.length > 0,
      message: notificationsSent.length > 0
        ? `Notification sent via ${notificationsSent.join(" and ")}`
        : "No notifications sent",
      channels: notificationsSent,
      jobStatus: job.status === "SCHEDULED" ? "EN_ROUTE" : job.status,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
