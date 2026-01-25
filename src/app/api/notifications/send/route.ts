/**
 * Send Notification API
 *
 * Manually send notifications to clients.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";
import { sendNotification, sendClientNotification, NotificationType } from "@/lib/notifications";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE"];

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { clientId, type, channel, customMessage, variables, scheduledFor } = body;

    if (!clientId) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    // Get client details
    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, org_id")
      .eq("id", clientId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // If custom message, send directly without template
    if (customMessage) {
      if (!channel) {
        return NextResponse.json({ error: "Channel required for custom message" }, { status: 400 });
      }

      const recipient = channel === "SMS" ? client.phone : client.email;
      if (!recipient) {
        return NextResponse.json(
          { error: `Client has no ${channel === "SMS" ? "phone" : "email"} on file` },
          { status: 400 }
        );
      }

      // Create notification record directly without template
      const { data: notification, error: insertError } = await supabase
        .from("notifications")
        .insert({
          org_id: auth.user.orgId,
          client_id: clientId,
          channel,
          recipient,
          body: customMessage,
          subject: channel === "EMAIL" ? "Message from DooGoodScoopers" : null,
          status: scheduledFor ? "PENDING" : "PENDING",
          scheduled_for: scheduledFor,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating notification:", insertError);
        return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
      }

      // If not scheduled, send immediately
      if (!scheduledFor) {
        // Import the actual sending functions
        const { sendSms, isTwilioConfigured } = await import("@/lib/twilio");
        const { sendEmail, isResendConfigured, wrapEmailHtml } = await import("@/lib/resend");

        let result;
        if (channel === "SMS") {
          if (!isTwilioConfigured()) {
            await supabase
              .from("notifications")
              .update({ status: "FAILED", error_message: "Twilio not configured" })
              .eq("id", notification.id);
            return NextResponse.json({ error: "SMS sending not configured" }, { status: 500 });
          }
          result = await sendSms({ to: recipient, body: customMessage });
        } else {
          if (!isResendConfigured()) {
            await supabase
              .from("notifications")
              .update({ status: "FAILED", error_message: "Resend not configured" })
              .eq("id", notification.id);
            return NextResponse.json({ error: "Email sending not configured" }, { status: 500 });
          }
          result = await sendEmail({
            to: recipient,
            subject: "Message from DooGoodScoopers",
            html: wrapEmailHtml(customMessage),
          });
        }

        if (result.success) {
          await supabase
            .from("notifications")
            .update({
              status: "SENT",
              sent_at: new Date().toISOString(),
              provider_id: result.messageId,
            })
            .eq("id", notification.id);

          return NextResponse.json({
            success: true,
            notificationId: notification.id,
            message: `${channel} sent successfully`,
          });
        } else {
          await supabase
            .from("notifications")
            .update({ status: "FAILED", error_message: result.error })
            .eq("id", notification.id);

          return NextResponse.json({ error: result.error || "Failed to send" }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        notificationId: notification.id,
        message: scheduledFor ? "Notification scheduled" : "Notification sent",
      });
    }

    // Template-based notification
    if (!type) {
      return NextResponse.json(
        { error: "Either type or customMessage is required" },
        { status: 400 }
      );
    }

    // Build variables for template
    const templateVars = {
      client_first_name: client.first_name,
      client_last_name: client.last_name,
      client_name: `${client.first_name} ${client.last_name}`,
      portal_link: `${process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.com"}/app/client`,
      ...variables,
    };

    // Send based on client preferences
    const results = await sendClientNotification({
      orgId: auth.user.orgId,
      clientId,
      type: type as NotificationType,
      phone: channel === "SMS" || !channel ? client.phone : undefined,
      email: channel === "EMAIL" || !channel ? client.email : undefined,
      variables: templateVars,
    });

    const sentChannels: string[] = [];
    const errors: string[] = [];

    if (results.sms) {
      if (results.sms.success) {
        sentChannels.push("SMS");
      } else {
        errors.push(`SMS: ${results.sms.error}`);
      }
    }
    if (results.email) {
      if (results.email.success) {
        sentChannels.push("Email");
      } else {
        errors.push(`Email: ${results.email.error}`);
      }
    }

    if (sentChannels.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent via ${sentChannels.join(" and ")}`,
      sms: results.sms,
      email: results.email,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
