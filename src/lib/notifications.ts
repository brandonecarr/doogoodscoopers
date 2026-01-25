/**
 * Unified Notification Service
 *
 * Send notifications via SMS (Twilio) or Email (Resend) using templates.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendSms, isTwilioConfigured, normalizePhoneNumber } from "./twilio";
import { sendEmail, isResendConfigured, renderTemplate, wrapEmailHtml } from "./resend";

export type NotificationChannel = "SMS" | "EMAIL";
export type NotificationType =
  | "ON_THE_WAY"
  | "DAY_AHEAD"
  | "COMPLETED"
  | "SKIPPED"
  | "OFF_SCHEDULE"
  | "PAYMENT_FAILED"
  | "WELCOME"
  | "REMARKETING_SMS"
  | "REMARKETING_EMAIL";
export type NotificationStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED";

export interface NotificationTemplate {
  id: string;
  orgId: string;
  type: NotificationType;
  channel: NotificationChannel;
  name: string;
  subject: string | null;
  body: string;
  isEnabled: boolean;
  variables: string[];
}

export interface SendNotificationOptions {
  orgId: string;
  clientId?: string;
  jobId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  variables?: Record<string, string>;
  scheduledFor?: Date;
}

export interface SendNotificationResult {
  success: boolean;
  notificationId?: string;
  providerId?: string;
  error?: string;
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * Get a notification template by type and channel
 */
export async function getTemplate(
  orgId: string,
  type: NotificationType,
  channel: NotificationChannel
): Promise<NotificationTemplate | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("type", type)
    .eq("channel", channel)
    .eq("is_enabled", true)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    orgId: data.org_id,
    type: data.type,
    channel: data.channel,
    name: data.name,
    subject: data.subject,
    body: data.body,
    isEnabled: data.is_enabled,
    variables: data.variables || [],
  };
}

/**
 * Send a notification immediately
 */
export async function sendNotification(
  options: SendNotificationOptions
): Promise<SendNotificationResult> {
  const supabase = getSupabase();

  // Get the template
  const template = await getTemplate(options.orgId, options.type, options.channel);
  if (!template) {
    return {
      success: false,
      error: `No enabled template found for ${options.type} via ${options.channel}`,
    };
  }

  // Render the message with variables
  const body = options.variables
    ? renderTemplate(template.body, options.variables)
    : template.body;

  const subject = template.subject && options.variables
    ? renderTemplate(template.subject, options.variables)
    : template.subject;

  // Create notification record
  const { data: notification, error: insertError } = await supabase
    .from("notifications")
    .insert({
      org_id: options.orgId,
      client_id: options.clientId,
      job_id: options.jobId,
      template_id: template.id,
      channel: options.channel,
      recipient: options.recipient,
      subject,
      body,
      status: options.scheduledFor ? "PENDING" : "PENDING",
      scheduled_for: options.scheduledFor?.toISOString(),
    })
    .select()
    .single();

  if (insertError || !notification) {
    return {
      success: false,
      error: insertError?.message || "Failed to create notification record",
    };
  }

  // If scheduled for later, don't send now
  if (options.scheduledFor && options.scheduledFor > new Date()) {
    return {
      success: true,
      notificationId: notification.id,
    };
  }

  // Send the notification
  let result: SendNotificationResult;

  if (options.channel === "SMS") {
    result = await sendSmsNotification(notification.id, options.recipient, body, supabase);
  } else {
    result = await sendEmailNotification(
      notification.id,
      options.recipient,
      subject || "Notification from DooGoodScoopers",
      body,
      supabase
    );
  }

  return {
    ...result,
    notificationId: notification.id,
  };
}

/**
 * Send an SMS notification
 */
async function sendSmsNotification(
  notificationId: string,
  to: string,
  body: string,
  supabase: SupabaseClient
): Promise<SendNotificationResult> {
  if (!isTwilioConfigured()) {
    await updateNotificationStatus(supabase, notificationId, "FAILED", "Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/twilio/status`
    : undefined;

  const result = await sendSms({
    to,
    body,
    statusCallback: webhookUrl,
  });

  if (result.success) {
    await updateNotificationStatus(supabase, notificationId, "SENT", undefined, result.messageId);
    return { success: true, providerId: result.messageId };
  } else {
    await updateNotificationStatus(supabase, notificationId, "FAILED", result.error);
    return { success: false, error: result.error };
  }
}

/**
 * Send an email notification
 */
async function sendEmailNotification(
  notificationId: string,
  to: string,
  subject: string,
  body: string,
  supabase: SupabaseClient
): Promise<SendNotificationResult> {
  if (!isResendConfigured()) {
    await updateNotificationStatus(supabase, notificationId, "FAILED", "Resend not configured");
    return { success: false, error: "Resend not configured" };
  }

  // Wrap body in HTML template if it's not already HTML
  const html = body.includes("<html") ? body : wrapEmailHtml(body, subject);

  const result = await sendEmail({
    to,
    subject,
    html,
    text: body.replace(/<[^>]*>/g, ""), // Strip HTML for plain text version
  });

  if (result.success) {
    await updateNotificationStatus(supabase, notificationId, "SENT", undefined, result.messageId);
    return { success: true, providerId: result.messageId };
  } else {
    await updateNotificationStatus(supabase, notificationId, "FAILED", result.error);
    return { success: false, error: result.error };
  }
}

/**
 * Update notification status in database
 */
async function updateNotificationStatus(
  supabase: SupabaseClient,
  notificationId: string,
  status: NotificationStatus,
  errorMessage?: string,
  providerId?: string
) {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "SENT" || status === "DELIVERED") {
    updates.sent_at = new Date().toISOString();
  }
  if (providerId) {
    updates.provider_id = providerId;
  }
  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  await supabase.from("notifications").update(updates).eq("id", notificationId);
}

/**
 * Process pending scheduled notifications
 */
export async function processPendingNotifications(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Get pending notifications that are due
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("status", "PENDING")
    .lte("scheduled_for", now)
    .limit(100);

  if (error || !pending) {
    console.error("Error fetching pending notifications:", error);
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of pending) {
    let result: SendNotificationResult;

    if (notification.channel === "SMS") {
      result = await sendSmsNotification(
        notification.id,
        notification.recipient,
        notification.body,
        supabase
      );
    } else {
      result = await sendEmailNotification(
        notification.id,
        notification.recipient,
        notification.subject || "Notification",
        notification.body,
        supabase
      );
    }

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}

/**
 * Get client notification preferences
 */
export async function getClientNotificationPreferences(
  clientId: string
): Promise<Record<string, boolean>> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("clients")
    .select("notification_preferences")
    .eq("id", clientId)
    .single();

  if (!data?.notification_preferences) {
    // Return defaults
    return {
      sms: true,
      email: true,
      dayAhead: true,
      onTheWay: true,
      completed: true,
    };
  }

  return data.notification_preferences;
}

/**
 * Send notification based on client preferences
 */
export async function sendClientNotification(options: {
  orgId: string;
  clientId: string;
  jobId?: string;
  type: NotificationType;
  phone?: string;
  email?: string;
  variables?: Record<string, string>;
}): Promise<{ sms?: SendNotificationResult; email?: SendNotificationResult }> {
  const prefs = await getClientNotificationPreferences(options.clientId);
  const results: { sms?: SendNotificationResult; email?: SendNotificationResult } = {};

  // Determine which channels to use based on type and preferences
  const typeToPreference: Record<string, string> = {
    ON_THE_WAY: "onTheWay",
    DAY_AHEAD: "dayAhead",
    COMPLETED: "completed",
    SKIPPED: "completed",
    PAYMENT_FAILED: "sms",
    WELCOME: "email",
  };

  const prefKey = typeToPreference[options.type] || "sms";
  const shouldSendSms = prefs.sms && prefs[prefKey] !== false && options.phone;
  const shouldSendEmail = prefs.email && prefs[prefKey] !== false && options.email;

  // Send SMS if enabled and phone provided
  if (shouldSendSms && options.phone) {
    const normalizedPhone = normalizePhoneNumber(options.phone);
    if (normalizedPhone) {
      results.sms = await sendNotification({
        orgId: options.orgId,
        clientId: options.clientId,
        jobId: options.jobId,
        type: options.type,
        channel: "SMS",
        recipient: normalizedPhone,
        variables: options.variables,
      });
    }
  }

  // Send email if enabled and email provided
  if (shouldSendEmail && options.email) {
    results.email = await sendNotification({
      orgId: options.orgId,
      clientId: options.clientId,
      jobId: options.jobId,
      type: options.type,
      channel: "EMAIL",
      recipient: options.email,
      variables: options.variables,
    });
  }

  return results;
}

/**
 * Cancel a pending notification
 */
export async function cancelNotification(notificationId: string): Promise<boolean> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("status", "PENDING");

  return !error;
}
