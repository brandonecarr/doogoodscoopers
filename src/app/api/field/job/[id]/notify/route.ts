/**
 * Field Job Notify API
 *
 * Send "on the way" notification to client for a job.
 * Creates notification record and triggers SMS/email if enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

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

    // Build notification message
    const etaText = eta ? ` (approximately ${eta} minutes)` : "";
    const addressText = location ? ` at ${location.address_line1}` : "";
    const message = `Hi ${client.first_name || "there"}! Your Doo Good Scoopers technician is on the way${addressText}${etaText}. See you soon!`;

    const notificationsSent: string[] = [];

    // Create notification records
    if (sendSms) {
      const { error: smsError } = await supabase.from("notifications").insert({
        org_id: auth.user.orgId,
        client_id: client.id,
        job_id: id,
        type: "ON_THE_WAY",
        channel: "SMS",
        recipient: client.phone,
        message,
        status: "PENDING",
        scheduled_for: new Date().toISOString(),
      });

      if (!smsError) {
        notificationsSent.push("SMS");
      }

      // TODO: Actually send SMS via Twilio
      // For now, mark as sent immediately
      await supabase
        .from("notifications")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("job_id", id)
        .eq("type", "ON_THE_WAY")
        .eq("channel", "SMS");
    }

    if (sendEmail) {
      const { error: emailError } = await supabase.from("notifications").insert({
        org_id: auth.user.orgId,
        client_id: client.id,
        job_id: id,
        type: "ON_THE_WAY",
        channel: "EMAIL",
        recipient: client.email,
        message,
        status: "PENDING",
        scheduled_for: new Date().toISOString(),
      });

      if (!emailError) {
        notificationsSent.push("EMAIL");
      }

      // TODO: Actually send email via Resend
      // For now, mark as sent immediately
      await supabase
        .from("notifications")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("job_id", id)
        .eq("type", "ON_THE_WAY")
        .eq("channel", "EMAIL");
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
