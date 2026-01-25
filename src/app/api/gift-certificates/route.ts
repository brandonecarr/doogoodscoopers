/**
 * Gift Certificates Public API
 *
 * Public endpoints for purchasing and validating gift certificates.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createGiftCertificateCheckout } from "@/lib/stripe";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * GET /api/gift-certificates?code=XXX
 * Validate a gift certificate code and return its balance (public)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    const { data: cert, error } = await supabase
      .from("gift_certificates")
      .select("id, code, balance_cents, status, expires_at")
      .eq("code", code.toUpperCase())
      .single();

    if (error || !cert) {
      return NextResponse.json({ error: "Gift certificate not found" }, { status: 404 });
    }

    // Check if expired
    const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();

    if (cert.status !== "ACTIVE" || isExpired || cert.balance_cents <= 0) {
      return NextResponse.json({
        valid: false,
        code: cert.code,
        status: isExpired ? "EXPIRED" : cert.status,
        balance: 0,
        message: isExpired ? "This gift certificate has expired" :
                 cert.status === "REDEEMED" ? "This gift certificate has been fully redeemed" :
                 cert.status === "CANCELED" ? "This gift certificate has been canceled" :
                 "This gift certificate is not valid",
      });
    }

    return NextResponse.json({
      valid: true,
      code: cert.code,
      status: cert.status,
      balance: cert.balance_cents / 100,
      balanceCents: cert.balance_cents,
      expiresAt: cert.expires_at,
    });
  } catch (error) {
    console.error("Error validating gift certificate:", error);
    return NextResponse.json({ error: "Failed to validate" }, { status: 500 });
  }
}

/**
 * POST /api/gift-certificates
 * Create a Stripe checkout session for purchasing a gift certificate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      message,
    } = body;

    // Validate required fields
    if (!amount || amount < 25 || amount > 500) {
      return NextResponse.json(
        { error: "Amount must be between $25 and $500" },
        { status: 400 }
      );
    }

    if (!purchaserName || !purchaserEmail) {
      return NextResponse.json(
        { error: "Purchaser name and email are required" },
        { status: 400 }
      );
    }

    if (!recipientName || !recipientEmail) {
      return NextResponse.json(
        { error: "Recipient name and email are required" },
        { status: 400 }
      );
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(purchaserEmail) || !emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.com";
    const successUrl = `${siteUrl}/gift-certificate/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/gift-certificate?canceled=true`;

    // Create Stripe checkout session
    const session = await createGiftCertificateCheckout(
      Math.round(amount * 100), // Convert to cents
      recipientEmail,
      recipientName,
      message || "",
      successUrl,
      cancelUrl
    );

    // Store purchaser info in metadata (Stripe session already has recipient info)
    // We'll need this when the webhook completes
    const supabase = getSupabase();

    // Get org ID
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "doogoodscoopers")
      .single();

    if (org) {
      // Store pending gift certificate with checkout session ID
      await supabase.from("gift_certificates").insert({
        org_id: org.id,
        code: `PENDING-${session.id.slice(-8)}`, // Temporary code until payment completes
        initial_value_cents: Math.round(amount * 100),
        balance_cents: Math.round(amount * 100),
        status: "PENDING", // Will be updated to ACTIVE on payment success
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        message: message || null,
        stripe_payment_intent_id: session.id, // Store session ID temporarily
      });
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating gift certificate checkout:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
