import nodemailer from "nodemailer";
import { SITE_CONFIG } from "./constants";

// SMTP Configuration from environment variables
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create reusable transporter
const createTransporter = () => {
  if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.warn("SMTP credentials not configured. Email sending disabled.");
    return null;
  }
  return nodemailer.createTransport(smtpConfig);
};

export interface QuoteEmailData {
  customerName: string;
  email: string;
  phone?: string;
  zipCode?: string;
  numberOfDogs?: number | string;
  frequency?: string;
  quoteAmount?: number | string;
  address?: string;
  city?: string;
  state?: string;
}

/**
 * Send a branded quote confirmation email to the customer
 */
export async function sendQuoteConfirmationEmail(data: QuoteEmailData): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email transporter not available. Skipping email send.");
    return false;
  }

  const fromEmail = process.env.SMTP_FROM || SITE_CONFIG.email;
  const fromName = process.env.SMTP_FROM_NAME || SITE_CONFIG.name;

  const emailHtml = generateQuoteEmailHtml(data);
  const emailText = generateQuoteEmailText(data);

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: data.email,
      subject: `Your Free Quote from ${SITE_CONFIG.name}`,
      text: emailText,
      html: emailHtml,
    });

    console.log(`Quote confirmation email sent to ${data.email}`);
    return true;
  } catch (error) {
    console.error("Failed to send quote confirmation email:", error);
    return false;
  }
}

/**
 * Send notification to business owner about new quote
 */
export async function sendQuoteNotificationEmail(data: QuoteEmailData): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email transporter not available. Skipping notification email.");
    return false;
  }

  const fromEmail = process.env.SMTP_FROM || SITE_CONFIG.email;
  const fromName = process.env.SMTP_FROM_NAME || SITE_CONFIG.name;
  const notifyEmail = process.env.NOTIFY_EMAIL || SITE_CONFIG.email;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: notifyEmail,
      subject: `New Quote Request from ${data.customerName}`,
      text: `
New Quote Request

Customer: ${data.customerName}
Email: ${data.email}
Phone: ${data.phone || "Not provided"}
Zip Code: ${data.zipCode || "Not provided"}
Number of Dogs: ${data.numberOfDogs || "Not specified"}
Service Frequency: ${data.frequency || "Not specified"}
${data.address ? `Address: ${data.address}, ${data.city || ""} ${data.state || ""} ${data.zipCode || ""}` : ""}
${data.quoteAmount ? `Quote Amount: $${data.quoteAmount}` : ""}

---
This notification was sent from the ${SITE_CONFIG.name} website.
      `.trim(),
    });

    console.log(`Quote notification email sent to ${notifyEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send quote notification email:", error);
    return false;
  }
}

/**
 * Generate HTML email template for quote confirmation
 */
function generateQuoteEmailHtml(data: QuoteEmailData): string {
  const primaryColor = "#0d4b4a"; // teal-900
  const accentColor = "#14b8a6"; // teal-500

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Quote from ${SITE_CONFIG.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🐾 ${SITE_CONFIG.name}
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                ${SITE_CONFIG.tagline}
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: ${primaryColor}; font-size: 24px;">
                Hi ${data.customerName}!
              </h2>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for requesting a free quote from ${SITE_CONFIG.name}! We're excited to help you enjoy a cleaner yard.
              </p>

              ${data.quoteAmount ? `
              <!-- Quote Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f0fdfa; border: 2px solid ${accentColor}; border-radius: 8px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                      Your Estimated Quote
                    </p>
                    <p style="margin: 0; color: ${primaryColor}; font-size: 36px; font-weight: 700;">
                      $${data.quoteAmount}
                    </p>
                    ${data.frequency ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">${data.frequency} service</p>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Service Details -->
              <h3 style="margin: 0 0 12px 0; color: ${primaryColor}; font-size: 18px;">
                Your Service Details
              </h3>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                ${data.numberOfDogs ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Number of Dogs</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; text-align: right; font-weight: 500;">${data.numberOfDogs}</td>
                </tr>
                ` : ""}
                ${data.frequency ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Service Frequency</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; text-align: right; font-weight: 500;">${data.frequency}</td>
                </tr>
                ` : ""}
                ${data.zipCode ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Service Area</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; text-align: right; font-weight: 500;">${data.zipCode}</td>
                </tr>
                ` : ""}
              </table>

              <!-- What's Next -->
              <h3 style="margin: 0 0 12px 0; color: ${primaryColor}; font-size: 18px;">
                What's Next?
              </h3>
              <ol style="margin: 0 0 24px 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                <li>A member of our team will review your quote</li>
                <li>We'll reach out within 24 hours to schedule your service</li>
                <li>Enjoy a cleaner, fresher yard!</li>
              </ol>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <a href="tel:${SITE_CONFIG.phone.replace(/[^0-9]/g, "")}" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Call Us: ${SITE_CONFIG.phone}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                      ${SITE_CONFIG.address.street}<br>
                      ${SITE_CONFIG.address.city}, ${SITE_CONFIG.address.state} ${SITE_CONFIG.address.zip}
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      © ${new Date().getFullYear()} ${SITE_CONFIG.name}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for quote confirmation
 */
function generateQuoteEmailText(data: QuoteEmailData): string {
  return `
Hi ${data.customerName}!

Thank you for requesting a free quote from ${SITE_CONFIG.name}!

${data.quoteAmount ? `Your Estimated Quote: $${data.quoteAmount}${data.frequency ? ` (${data.frequency} service)` : ""}` : ""}

YOUR SERVICE DETAILS
${data.numberOfDogs ? `- Number of Dogs: ${data.numberOfDogs}` : ""}
${data.frequency ? `- Service Frequency: ${data.frequency}` : ""}
${data.zipCode ? `- Service Area: ${data.zipCode}` : ""}

WHAT'S NEXT?
1. A member of our team will review your quote
2. We'll reach out within 24 hours to schedule your service
3. Enjoy a cleaner, fresher yard!

Have questions? Give us a call at ${SITE_CONFIG.phone}

---
${SITE_CONFIG.name}
${SITE_CONFIG.address.street}
${SITE_CONFIG.address.city}, ${SITE_CONFIG.address.state} ${SITE_CONFIG.address.zip}
${SITE_CONFIG.email}
  `.trim();
}
