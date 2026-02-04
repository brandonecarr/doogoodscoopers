/**
 * Admin Gift Certificates API
 *
 * Manage gift certificates: list, create, update status, resend.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";
import { sendGiftCertificateEmail } from "@/lib/email";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE", "ACCOUNTANT"];

/**
 * GET /api/admin/gift-certificates
 * List all gift certificates with filtering
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("gift_certificates")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .neq("status", "PENDING") // Don't show incomplete purchases
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `code.ilike.%${search}%,recipient_name.ilike.%${search}%,recipient_email.ilike.%${search}%,purchaser_name.ilike.%${search}%`
      );
    }

    const { data: certificates, error } = await query.limit(100);

    if (error) {
      console.error("Error fetching gift certificates:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    // Get redemption counts
    const certIds = (certificates || []).map((c) => c.id);
    let redemptionCounts: Record<string, number> = {};

    if (certIds.length > 0) {
      const { data: redemptions } = await supabase
        .from("gift_certificate_redemptions")
        .select("gift_certificate_id")
        .in("gift_certificate_id", certIds);

      for (const r of redemptions || []) {
        redemptionCounts[r.gift_certificate_id] = (redemptionCounts[r.gift_certificate_id] || 0) + 1;
      }
    }

    // Calculate stats
    const stats = {
      total: certificates?.length || 0,
      active: certificates?.filter((c) => c.status === "ACTIVE").length || 0,
      redeemed: certificates?.filter((c) => c.status === "REDEEMED").length || 0,
      totalValue: certificates?.reduce((sum, c) => sum + c.initial_value_cents, 0) || 0,
      totalRedeemed: certificates?.reduce((sum, c) => sum + (c.initial_value_cents - c.balance_cents), 0) || 0,
    };

    return NextResponse.json({
      certificates: (certificates || []).map((c) => ({
        id: c.id,
        code: c.code,
        initialValue: c.initial_value_cents / 100,
        balance: c.balance_cents / 100,
        status: c.status,
        purchaserName: c.purchaser_name,
        purchaserEmail: c.purchaser_email,
        recipientName: c.recipient_name,
        recipientEmail: c.recipient_email,
        message: c.message,
        expiresAt: c.expires_at,
        deliveredAt: c.delivered_at,
        redemptionCount: redemptionCounts[c.id] || 0,
        createdAt: c.created_at,
      })),
      stats: {
        ...stats,
        totalValue: stats.totalValue / 100,
        totalRedeemed: stats.totalRedeemed / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching gift certificates:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/admin/gift-certificates
 * Create a gift certificate manually (admin-issued)
 */
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
    const {
      amount,
      recipientName,
      recipientEmail,
      purchaserName,
      purchaserEmail,
      purchaserPhone,
      clientId,
      message,
      expiresAt,
      purchasedAt,
      referenceNumber,
      sendEmail,
    } = body;

    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Amount required" }, { status: 400 });
    }

    // Generate unique code
    const code = generateGiftCertificateCode();

    const { data: cert, error: insertError } = await supabase
      .from("gift_certificates")
      .insert({
        org_id: auth.user.orgId,
        code,
        initial_value_cents: Math.round(amount * 100),
        balance_cents: Math.round(amount * 100),
        status: "ACTIVE",
        purchaser_name: purchaserName || "Admin",
        purchaser_email: purchaserEmail || auth.user.email || "admin@doogoodscoopers.com",
        purchaser_phone: purchaserPhone || null,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        client_id: clientId || null,
        message: message || null,
        expires_at: expiresAt || null,
        purchased_at: purchasedAt || null,
        reference_number: referenceNumber || null,
        delivered_at: sendEmail ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError || !cert) {
      console.error("Error creating gift certificate:", insertError);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }

    // Send email if requested
    if (sendEmail) {
      try {
        await sendGiftCertificateEmail({
          recipientEmail,
          recipientName,
          code,
          amount,
          message: message || undefined,
          expiresAt: expiresAt || undefined,
        });
      } catch (emailError) {
        console.error("Failed to send gift certificate email:", emailError);
        // Don't fail the creation, just log
      }
    }

    return NextResponse.json(
      {
        certificate: {
          id: cert.id,
          code: cert.code,
          initialValue: cert.initial_value_cents / 100,
          balance: cert.balance_cents / 100,
          status: cert.status,
          recipientName: cert.recipient_name,
          recipientEmail: cert.recipient_email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating gift certificate:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/gift-certificates
 * Update gift certificate (cancel, resend email, adjust balance)
 */
export async function PUT(request: NextRequest) {
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
    const { id, action, newBalance } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Get existing certificate
    const { data: cert } = await supabase
      .from("gift_certificates")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!cert) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "cancel") {
      await supabase
        .from("gift_certificates")
        .update({
          status: "CANCELED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "Certificate canceled" });
    }

    if (action === "resend") {
      try {
        await sendGiftCertificateEmail({
          recipientEmail: cert.recipient_email,
          recipientName: cert.recipient_name,
          code: cert.code,
          amount: cert.balance_cents / 100,
          message: cert.message || undefined,
          expiresAt: cert.expires_at || undefined,
        });

        await supabase
          .from("gift_certificates")
          .update({
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        return NextResponse.json({ success: true, message: "Email sent" });
      } catch (emailError) {
        console.error("Failed to resend email:", emailError);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
      }
    }

    if (action === "adjust" && typeof newBalance === "number") {
      const newBalanceCents = Math.round(newBalance * 100);

      await supabase
        .from("gift_certificates")
        .update({
          balance_cents: newBalanceCents,
          status: newBalanceCents > 0 ? "ACTIVE" : "REDEEMED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "Balance adjusted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating gift certificate:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

function generateGiftCertificateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing characters
  let code = "GC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
