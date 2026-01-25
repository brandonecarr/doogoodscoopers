/**
 * Marketing Sync Service
 *
 * Handles syncing contact data to marketing integrations.
 * Supports Mailchimp, EZTexting, Direct Mail webhooks, and generic webhooks.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export type SyncEventType =
  | "ONETIME_SIGNUP"
  | "RECURRING_SIGNUP"
  | "PARTIAL_SUBMISSION"
  | "CANCELED_CLIENT"
  | "ONETIME_JOB_COMPLETED";

export interface ContactData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  dogCount?: number;
  frequency?: string;
  planName?: string;
  subscriptionValue?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface SyncOptions {
  orgId: string;
  eventType: SyncEventType;
  contact: ContactData;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Queue a marketing sync event for processing
 */
export async function queueMarketingSync(options: SyncOptions): Promise<{ success: boolean; eventId?: string }> {
  const supabase = getSupabase();

  try {
    // Get enabled integrations for this org
    const { data: integrations } = await supabase
      .from("marketing_integrations")
      .select("id, provider, config")
      .eq("org_id", options.orgId)
      .eq("is_enabled", true);

    if (!integrations || integrations.length === 0) {
      return { success: true }; // No integrations to sync to
    }

    // Create sync events for each integration
    const syncEvents = integrations.map((integration) => ({
      org_id: options.orgId,
      integration_id: integration.id,
      provider: integration.provider,
      event_type: options.eventType,
      contact: options.contact,
      tags: options.tags || [],
      status: "PENDING",
    }));

    const { data: events, error } = await supabase
      .from("marketing_sync_events")
      .insert(syncEvents)
      .select("id");

    if (error) {
      console.error("Error queueing marketing sync:", error);
      return { success: false };
    }

    return {
      success: true,
      eventId: events?.[0]?.id,
    };
  } catch (error) {
    console.error("Error in queueMarketingSync:", error);
    return { success: false };
  }
}

/**
 * Process pending marketing sync events
 * Called by cron job
 */
export async function processPendingSyncEvents(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = getSupabase();
  const results = { processed: 0, succeeded: 0, failed: 0 };

  try {
    // Get pending events (limit to batch size)
    const { data: events, error: fetchError } = await supabase
      .from("marketing_sync_events")
      .select(`
        id,
        org_id,
        integration_id,
        provider,
        event_type,
        contact,
        tags,
        attempt_count
      `)
      .eq("status", "PENDING")
      .lt("attempt_count", 3) // Max 3 retries
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError || !events) {
      console.error("Error fetching sync events:", fetchError);
      return results;
    }

    // Get integration configs
    const integrationIds = [...new Set(events.map((e) => e.integration_id))];
    const { data: integrations } = await supabase
      .from("marketing_integrations")
      .select("id, provider, config")
      .in("id", integrationIds);

    const integrationMap = new Map(integrations?.map((i) => [i.id, i]) || []);

    // Process each event
    for (const event of events) {
      results.processed++;

      const integration = integrationMap.get(event.integration_id);
      if (!integration) {
        await markEventFailed(supabase, event.id, "Integration not found");
        results.failed++;
        continue;
      }

      try {
        const sendResult = await sendToProvider(
          event.provider,
          integration.config,
          event.event_type,
          event.contact,
          event.tags
        );

        if (sendResult.success) {
          await supabase
            .from("marketing_sync_events")
            .update({
              status: "SUCCESS",
              last_attempt_at: new Date().toISOString(),
              attempt_count: event.attempt_count + 1,
            })
            .eq("id", event.id);
          results.succeeded++;
        } else {
          await markEventFailed(supabase, event.id, sendResult.error || "Unknown error", event.attempt_count);
          results.failed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await markEventFailed(supabase, event.id, errorMsg, event.attempt_count);
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error("Error processing sync events:", error);
    return results;
  }
}

async function markEventFailed(
  supabase: ReturnType<typeof getSupabase>,
  eventId: string,
  error: string,
  attemptCount: number = 0
): Promise<void> {
  const newAttemptCount = attemptCount + 1;
  const isFinalFailure = newAttemptCount >= 3;

  await supabase
    .from("marketing_sync_events")
    .update({
      status: isFinalFailure ? "FAILED" : "PENDING",
      error,
      attempt_count: newAttemptCount,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

/**
 * Send data to a specific provider
 */
async function sendToProvider(
  provider: string,
  config: Record<string, unknown>,
  eventType: string,
  contact: ContactData,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  switch (provider) {
    case "MAILCHIMP":
      return sendToMailchimp(config, eventType, contact, tags);

    case "EZTEXTING":
      return sendToEZTexting(config, eventType, contact, tags);

    case "DIRECT_MAIL":
      return sendToDirectMail(config, eventType, contact, tags);

    case "WEBHOOK_GENERIC":
      return sendToGenericWebhook(config, eventType, contact, tags);

    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Mailchimp Integration
 */
async function sendToMailchimp(
  config: Record<string, unknown>,
  eventType: string,
  contact: ContactData,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  const apiKey = config.apiKey as string;
  const listId = config.listId as string;

  if (!apiKey || !listId) {
    return { success: false, error: "Mailchimp API key and list ID required" };
  }

  if (!contact.email) {
    return { success: false, error: "Email required for Mailchimp" };
  }

  // Extract datacenter from API key (e.g., "us21")
  const dc = apiKey.split("-").pop();
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

  try {
    // Add/update subscriber
    const subscriberHash = await md5(contact.email.toLowerCase());
    const response = await fetch(`${baseUrl}/lists/${listId}/members/${subscriberHash}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: contact.email,
        status_if_new: "subscribed",
        merge_fields: {
          FNAME: contact.firstName || "",
          LNAME: contact.lastName || "",
          PHONE: contact.phone || "",
          ADDRESS: contact.address
            ? {
                addr1: contact.address.line1 || "",
                addr2: contact.address.line2 || "",
                city: contact.address.city || "",
                state: contact.address.state || "",
                zip: contact.address.zip || "",
              }
            : undefined,
        },
        tags: [...tags, eventType],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.detail || "Mailchimp API error" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Mailchimp request failed" };
  }
}

/**
 * EZTexting Integration
 */
async function sendToEZTexting(
  config: Record<string, unknown>,
  eventType: string,
  contact: ContactData,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  const username = config.username as string;
  const apiKey = config.apiKey as string;
  const groupId = config.groupId as string;

  if (!username || !apiKey) {
    return { success: false, error: "EZTexting credentials required" };
  }

  if (!contact.phone) {
    return { success: false, error: "Phone required for EZTexting" };
  }

  try {
    // Note: EZTexting API v2 format
    const response = await fetch("https://app.eztexting.com/api/v1/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        phoneNumber: contact.phone.replace(/\D/g, ""),
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        email: contact.email || "",
        groups: groupId ? [groupId] : [],
        customFields: {
          event_type: eventType,
          tags: tags.join(","),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: error || "EZTexting API error" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "EZTexting request failed" };
  }
}

/**
 * Direct Mail Integration (sends to webhook for CSV generation/mailing service)
 */
async function sendToDirectMail(
  config: Record<string, unknown>,
  eventType: string,
  contact: ContactData,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = config.webhookUrl as string;

  if (!webhookUrl) {
    return { success: false, error: "Direct mail webhook URL required" };
  }

  // Requires full address for direct mail
  if (!contact.address?.line1 || !contact.address?.city || !contact.address?.state || !contact.address?.zip) {
    return { success: false, error: "Full address required for direct mail" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Event-Type": eventType,
      },
      body: JSON.stringify({
        eventType,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          address: {
            line1: contact.address.line1,
            line2: contact.address.line2 || "",
            city: contact.address.city,
            state: contact.address.state,
            zip: contact.address.zip,
          },
        },
        metadata: {
          dogCount: contact.dogCount,
          frequency: contact.frequency,
          planName: contact.planName,
          tags,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Direct mail webhook failed" };
  }
}

/**
 * Generic Webhook Integration
 */
async function sendToGenericWebhook(
  config: Record<string, unknown>,
  eventType: string,
  contact: ContactData,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = config.url as string;
  const secret = config.secret as string;

  if (!webhookUrl) {
    return { success: false, error: "Webhook URL required" };
  }

  try {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      contact: {
        email: contact.email,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
        address: contact.address,
        dogCount: contact.dogCount,
        frequency: contact.frequency,
        planName: contact.planName,
        subscriptionValue: contact.subscriptionValue,
        customFields: contact.customFields,
      },
      tags,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Event-Type": eventType,
    };

    // Add HMAC signature if secret is configured
    if (secret) {
      const signature = await hmacSign(JSON.stringify(payload), secret);
      headers["X-Webhook-Signature"] = signature;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook request failed" };
  }
}

// Helper function for MD5 hash (used by Mailchimp)
async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("MD5", data).catch(() => {
    // Fallback for environments that don't support MD5
    // Use simple hash as fallback
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return new Uint8Array([hash & 0xff, (hash >> 8) & 0xff, (hash >> 16) & 0xff, (hash >> 24) & 0xff]);
  });
  const hashArray = Array.from(new Uint8Array(hashBuffer instanceof ArrayBuffer ? hashBuffer : hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper function for HMAC signing
async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
