/**
 * Resend Email Integration
 *
 * Send transactional emails via Resend.
 */

import { Resend } from "resend";
import { brevoSend, isBrevoConfigured, parseAddr } from "@/lib/brevo-email";

const apiKey = process.env.RESEND_API_KEY;
// Default sender = our verified Brevo sender. An unverified address is rejected.
const fromEmail =
  process.env.EMAIL_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  "DooGoodScoopers <service@doogoodscoopers.com>";

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/** True when any email provider is configured (Brevo preferred, Resend fallback). */
export function isResendConfigured(): boolean {
  return isBrevoConfigured() || !!apiKey;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Prefer Brevo when configured.
  if (isBrevoConfigured()) {
    const to = (Array.isArray(options.to) ? options.to : [options.to]).map((email) => ({ email }));
    const r = await brevoSend({
      from: parseAddr(options.from || fromEmail),
      to,
      subject: options.subject,
      html: options.html || "<p>No content</p>",
      text: options.text,
      replyTo: options.replyTo,
      tags: options.tags?.map((t) => t.value),
    });
    return r.messageId ? { success: true, messageId: r.messageId } : { success: false, error: r.error };
  }

  const client = getClient();

  if (!client) {
    console.warn("No email provider configured - email not sent");
    return {
      success: false,
      error: "Email provider not configured",
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailPayload: any = {
      from: options.from || fromEmail,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html || "<p>No content</p>",
    };

    if (options.text) {
      emailPayload.text = options.text;
    }
    if (options.replyTo) {
      emailPayload.replyTo = options.replyTo;
    }
    if (options.tags) {
      emailPayload.tags = options.tags;
    }

    const { data, error } = await client.emails.send(emailPayload);

    if (error) {
      console.error("Resend email error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Resend email error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send a templated email with variable substitution
 */
export async function sendTemplatedEmail(
  options: Omit<SendEmailOptions, "html" | "text"> & {
    template: string;
    variables: Record<string, string>;
  }
): Promise<SendEmailResult> {
  const html = renderTemplate(options.template, options.variables);
  return sendEmail({
    ...options,
    html,
  });
}

/**
 * Render a template with variable substitution
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace {{key}} with value
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Create a branded HTML email wrapper
 */
export function wrapEmailHtml(content: string, title?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || "DooGoodScoopers"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #0d4b4a 0%, #14b8a6 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #14b8a6;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
    .footer a {
      color: #14b8a6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DooGoodScoopers</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>DooGoodScoopers - Professional Pet Waste Removal</p>
      <p>
        <a href="https://doogoodscoopers.com">Website</a> |
        <a href="mailto:support@doogoodscoopers.com">Contact Us</a>
      </p>
      <p>&copy; ${new Date().getFullYear()} DooGoodScoopers. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
