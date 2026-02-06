/**
 * Magic Link API
 *
 * Generates a magic link via Supabase Auth Admin and sends it
 * through our own SMTP transport (nodemailer), bypassing
 * Supabase's built-in email delivery.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { SITE_CONFIG } from "@/lib/constants";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, redirectTo } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Generate the magic link via Supabase Admin API
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: {
        redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.com"}/auth/callback`,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error("Failed to generate magic link:", error?.message);
      return NextResponse.json(
        { error: "Failed to generate login link. Please try password login." },
        { status: 500 }
      );
    }

    const magicLink = data.properties.action_link;

    // Send the email via our own SMTP
    const transporter = createTransporter();
    if (!transporter) {
      console.error("SMTP not configured - cannot send magic link email");
      return NextResponse.json(
        { error: "Email service not configured. Please try password login." },
        { status: 500 }
      );
    }

    const fromEmail = process.env.SMTP_FROM || SITE_CONFIG.email;
    const fromName = process.env.SMTP_FROM_NAME || SITE_CONFIG.name;
    const primaryColor = "#0d4b4a";
    const accentColor = "#14b8a6";

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: `Sign in to ${SITE_CONFIG.name}`,
      text: `Sign in to ${SITE_CONFIG.name}\n\nClick the link below to sign in:\n${magicLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${SITE_CONFIG.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background-color: ${primaryColor}; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${SITE_CONFIG.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: ${primaryColor}; font-size: 24px;">Sign in to your account</h2>
              <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Click the button below to sign in. This link expires in 1 hour.
              </p>
              <a href="${magicLink}" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Sign In
              </a>
              <p style="margin: 32px 0 0 0; color: #9ca3af; font-size: 13px;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} ${SITE_CONFIG.name}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try password login." },
      { status: 500 }
    );
  }
}
