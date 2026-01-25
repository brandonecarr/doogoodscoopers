/**
 * Twilio SMS Integration
 *
 * Send SMS messages and handle inbound webhooks.
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!accountSid || !authToken) {
    return null;
  }
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface SendSmsOptions {
  to: string;
  body: string;
  statusCallback?: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  const client = getClient();

  if (!client || !fromNumber) {
    console.warn("Twilio not configured - SMS not sent");
    return {
      success: false,
      error: "Twilio not configured",
    };
  }

  // Normalize phone number to E.164 format
  const normalizedTo = normalizePhoneNumber(options.to);
  if (!normalizedTo) {
    return {
      success: false,
      error: "Invalid phone number format",
    };
  }

  try {
    const message = await client.messages.create({
      body: options.body,
      from: fromNumber,
      to: normalizedTo,
      statusCallback: options.statusCallback,
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Twilio SMS error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Normalize a phone number to E.164 format for US numbers
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Strip all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Already has country code
  if (digits.length > 10 && phone.startsWith("+")) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) {
    console.warn("Cannot validate Twilio signature - auth token not configured");
    return false;
  }

  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch (error) {
    console.error("Error validating Twilio signature:", error);
    return false;
  }
}

/**
 * Parse inbound SMS webhook data from Twilio
 */
export interface InboundSmsData {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
}

export function parseInboundSms(params: Record<string, string>): InboundSmsData {
  const numMedia = parseInt(params.NumMedia || "0", 10);
  const mediaUrls: string[] = [];

  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`];
    if (url) {
      mediaUrls.push(url);
    }
  }

  return {
    messageSid: params.MessageSid || "",
    from: params.From || "",
    to: params.To || "",
    body: params.Body || "",
    numMedia,
    mediaUrls,
  };
}

/**
 * Generate TwiML response for webhooks
 */
export function twimlResponse(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Get message status from Twilio
 */
export async function getMessageStatus(messageSid: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const message = await client.messages(messageSid).fetch();
    return message.status;
  } catch (error) {
    console.error("Error fetching message status:", error);
    return null;
  }
}
