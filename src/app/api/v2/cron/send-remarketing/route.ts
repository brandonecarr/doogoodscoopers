/**
 * Remarketing Notification Cron
 *
 * Sends follow-up notifications to abandoned onboarding sessions.
 * Should run hourly via external cron service.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms, isTwilioConfigured, normalizePhoneNumber } from "@/lib/twilio";
import { sendEmail, isResendConfigured, wrapEmailHtml } from "@/lib/resend";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface RemarketingTemplate {
  id: string;
  type: string;
  channel: string;
  subject: string | null;
  body: string;
}

interface AbandonedSession {
  id: string;
  org_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  remarketing_sent_count: number;
  abandoned_at: string;
  zip: string | null;
  frequency: string | null;
}

/**
 * GET /api/v2/cron/send-remarketing
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const results = {
    processed: 0,
    smsSent: 0,
    emailSent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Get organization settings
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings")
      .single();

    if (!org) {
      return NextResponse.json({
        success: false,
        error: "Organization not found",
      });
    }

    const settings = org.settings || {};
    const remarketingEnabled = settings.remarketing_enabled !== false;
    const maxMessages = settings.remarketingMaxMessages || 3;

    if (!remarketingEnabled) {
      return NextResponse.json({
        success: true,
        message: "Remarketing disabled",
        ...results,
      });
    }

    // Get abandoned sessions eligible for remarketing
    // Criteria:
    // - Status is ABANDONED
    // - Has contact info (email or phone)
    // - remarketing_sent_count < maxMessages
    // - abandoned_at is at least 1 hour ago (give time for natural return)
    // - abandoned_at is less than 7 days ago (don't spam old sessions)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("id, org_id, contact_name, contact_email, contact_phone, remarketing_sent_count, abandoned_at, zip, frequency")
      .eq("status", "ABANDONED")
      .lt("remarketing_sent_count", maxMessages)
      .lt("abandoned_at", oneHourAgo)
      .gt("abandoned_at", sevenDaysAgo)
      .order("abandoned_at", { ascending: true })
      .limit(50); // Process in batches

    if (sessionError) {
      console.error("Error fetching abandoned sessions:", sessionError);
      return NextResponse.json({
        success: false,
        error: "Failed to fetch sessions",
      });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No sessions to process",
        ...results,
      });
    }

    // Get remarketing templates
    const { data: templates } = await supabase
      .from("notification_templates")
      .select("id, type, channel, subject, body")
      .eq("org_id", org.id)
      .in("type", ["REMARKETING_SMS", "REMARKETING_EMAIL"])
      .eq("is_enabled", true);

    const smsTemplate = templates?.find((t) => t.type === "REMARKETING_SMS") as RemarketingTemplate | undefined;
    const emailTemplate = templates?.find((t) => t.type === "REMARKETING_EMAIL") as RemarketingTemplate | undefined;

    if (!smsTemplate && !emailTemplate) {
      return NextResponse.json({
        success: true,
        message: "No remarketing templates enabled",
        ...results,
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.com";

    // Process each session
    for (const session of sessions as AbandonedSession[]) {
      results.processed++;

      // Determine delay based on how many messages already sent
      // First message: after 1 hour, Second: after 24 hours, Third: after 72 hours
      const delayHours = [1, 24, 72];
      const requiredDelay = delayHours[session.remarketing_sent_count] || 24;
      const requiredDelayMs = requiredDelay * 60 * 60 * 1000;
      const timeSinceAbandoned = Date.now() - new Date(session.abandoned_at).getTime();

      if (timeSinceAbandoned < requiredDelayMs) {
        results.skipped++;
        continue;
      }

      // Build template variables
      const resumeLink = `${siteUrl}/quote?resume=${session.id}`;
      const variables: Record<string, string> = {
        contact_name: session.contact_name || "there",
        resume_link: resumeLink,
        zip: session.zip || "",
        frequency: session.frequency || "",
      };

      let messageSent = false;

      // Try SMS first if we have phone
      if (smsTemplate && session.contact_phone && isTwilioConfigured()) {
        const normalizedPhone = normalizePhoneNumber(session.contact_phone);
        if (normalizedPhone) {
          const body = renderTemplate(smsTemplate.body, variables);
          const result = await sendSms({
            to: normalizedPhone,
            body,
          });

          if (result.success) {
            results.smsSent++;
            messageSent = true;

            // Log notification
            await supabase.from("notifications").insert({
              org_id: session.org_id,
              type: "REMARKETING_SMS",
              channel: "SMS",
              recipient: normalizedPhone,
              status: "SENT",
              provider_message_id: result.messageId,
              content: { body },
            });
          } else {
            results.errors.push(`SMS failed for session ${session.id}: ${result.error}`);
          }
        }
      }

      // Try email if we have email and SMS wasn't sent
      if (!messageSent && emailTemplate && session.contact_email && isResendConfigured()) {
        const body = renderTemplate(emailTemplate.body, variables);
        const subject = renderTemplate(emailTemplate.subject || "Complete your signup!", variables);

        const result = await sendEmail({
          to: session.contact_email,
          subject,
          html: wrapEmailHtml(body.replace(/\n/g, "<br>")),
        });

        if (result.success) {
          results.emailSent++;
          messageSent = true;

          // Log notification
          await supabase.from("notifications").insert({
            org_id: session.org_id,
            type: "REMARKETING_EMAIL",
            channel: "EMAIL",
            recipient: session.contact_email,
            status: "SENT",
            provider_message_id: result.messageId,
            content: { subject, body },
          });
        } else {
          results.errors.push(`Email failed for session ${session.id}: ${result.error}`);
        }
      }

      // Update session if message was sent
      if (messageSent) {
        await supabase
          .from("onboarding_sessions")
          .update({
            remarketing_sent_count: session.remarketing_sent_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        // Log event
        await supabase.from("onboarding_events").insert({
          org_id: session.org_id,
          session_id: session.id,
          event_type: "REMARKETING_SENT",
          metadata: {
            message_number: session.remarketing_sent_count + 1,
            channel: results.smsSent > 0 ? "SMS" : "EMAIL",
          },
        });
      } else {
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("Remarketing cron error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal error",
      ...results,
    });
  }
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
