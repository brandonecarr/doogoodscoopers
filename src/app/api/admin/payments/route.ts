/**
 * Payments Management API
 *
 * List and manage payment records.
 * Requires payments:read for GET, payments:process for recording, payments:refund for refunds.
 *
 * GET /api/admin/payments - List all payments with filters
 * POST /api/admin/payments - Record a new payment
 * PUT /api/admin/payments - Update payment (e.g., process refund)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

/**
 * GET /api/admin/payments
 * List all payments with related data
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "payments:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const method = searchParams.get("method");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let query = supabase
    .from("payments")
    .select(
      `
      id,
      amount_cents,
      currency,
      status,
      payment_method,
      stripe_payment_intent_id,
      stripe_charge_id,
      failure_reason,
      refunded_amount_cents,
      metadata,
      created_at,
      updated_at,
      client:client_id (
        id,
        first_name,
        last_name,
        email
      ),
      invoice:invoice_id (
        id,
        invoice_number,
        total_cents
      )
    `,
      { count: "exact" }
    )
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  // Filter by status
  if (status && PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    query = query.eq("status", status);
  }

  // Filter by client
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  // Filter by method
  if (method) {
    query = query.eq("payment_method", method);
  }

  // Filter by date range
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59`);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: payments, error, count } = await query;

  if (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }

  // Get stats
  const { data: allPayments } = await supabase
    .from("payments")
    .select("status, amount_cents, refunded_amount_cents, payment_method")
    .eq("org_id", auth.user.orgId);

  const succeeded = allPayments?.filter((p) => p.status === "SUCCEEDED") || [];
  const refunded = allPayments?.filter((p) => ["REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)) || [];

  const stats = {
    total: allPayments?.length || 0,
    succeeded: succeeded.length,
    pending: allPayments?.filter((p) => p.status === "PENDING").length || 0,
    failed: allPayments?.filter((p) => p.status === "FAILED").length || 0,
    refunded: refunded.length,
    totalCollectedCents: succeeded.reduce((sum, p) => sum + p.amount_cents, 0),
    totalRefundedCents: allPayments?.reduce((sum, p) => sum + (p.refunded_amount_cents || 0), 0) || 0,
    netRevenueCents:
      succeeded.reduce((sum, p) => sum + p.amount_cents, 0) -
      (allPayments?.reduce((sum, p) => sum + (p.refunded_amount_cents || 0), 0) || 0),
    byMethod: {
      card: allPayments?.filter((p) => p.payment_method === "card" && p.status === "SUCCEEDED").length || 0,
      cash: allPayments?.filter((p) => p.payment_method === "cash" && p.status === "SUCCEEDED").length || 0,
      check: allPayments?.filter((p) => p.payment_method === "check" && p.status === "SUCCEEDED").length || 0,
      ach: allPayments?.filter((p) => p.payment_method === "ach" && p.status === "SUCCEEDED").length || 0,
    },
  };

  // Format payments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedPayments = (payments || []).map((pmt: any) => ({
    id: pmt.id,
    amountCents: pmt.amount_cents,
    currency: pmt.currency,
    status: pmt.status,
    paymentMethod: pmt.payment_method,
    stripePaymentIntentId: pmt.stripe_payment_intent_id,
    stripeChargeId: pmt.stripe_charge_id,
    failureReason: pmt.failure_reason,
    refundedAmountCents: pmt.refunded_amount_cents || 0,
    metadata: pmt.metadata,
    createdAt: pmt.created_at,
    client: pmt.client
      ? {
          id: pmt.client.id,
          name: [pmt.client.first_name, pmt.client.last_name].filter(Boolean).join(" "),
          email: pmt.client.email,
        }
      : null,
    invoice: pmt.invoice
      ? {
          id: pmt.invoice.id,
          invoiceNumber: pmt.invoice.invoice_number,
          totalCents: pmt.invoice.total_cents,
        }
      : null,
  }));

  return NextResponse.json({
    payments: formattedPayments,
    stats,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

/**
 * POST /api/admin/payments
 * Record a new payment (manual payment entry)
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "payments:process");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      clientId,
      invoiceId,
      amountCents,
      paymentMethod,
      referenceNumber,
      notes,
    } = body;

    // Validate required fields
    if (!clientId || !amountCents) {
      return NextResponse.json(
        { error: "Client and amount are required" },
        { status: 400 }
      );
    }

    // Verify client exists
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify invoice if provided
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, client_id, total_cents, amount_paid_cents")
        .eq("id", invoiceId)
        .eq("org_id", auth.user.orgId)
        .single();

      if (!invoice || invoice.client_id !== clientId) {
        return NextResponse.json({ error: "Invoice not found or doesn't belong to this client" }, { status: 404 });
      }
    }

    // Build metadata
    const metadata: Record<string, unknown> = {};
    if (referenceNumber) metadata.referenceNumber = referenceNumber;
    if (notes) metadata.notes = notes;

    // Create payment
    const { data: newPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        invoice_id: invoiceId || null,
        amount_cents: amountCents,
        status: "SUCCEEDED",
        payment_method: paymentMethod || null,
        metadata,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    // Update invoice if linked
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("total_cents, amount_paid_cents")
        .eq("id", invoiceId)
        .single();

      if (invoice) {
        const newPaidCents = (invoice.amount_paid_cents || 0) + amountCents;
        const newDueCents = Math.max(0, invoice.total_cents - newPaidCents);
        const newStatus = newPaidCents >= invoice.total_cents ? "PAID" : "OPEN";

        await supabase
          .from("invoices")
          .update({
            amount_paid_cents: newPaidCents,
            amount_due_cents: newDueCents,
            status: newStatus,
            paid_at: newStatus === "PAID" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "PAYMENT_RECORDED",
      entity_type: "PAYMENT",
      entity_id: newPayment.id,
      details: { amountCents, paymentMethod, clientId, invoiceId },
    });

    return NextResponse.json({ payment: newPayment }, { status: 201 });
  } catch (error) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/payments
 * Update payment (e.g., process refund)
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "payments:refund");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, refundAmountCents, refundReason } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // Verify payment belongs to org
    const { data: existing } = await supabase
      .from("payments")
      .select("id, amount_cents, status, invoice_id, refunded_amount_cents, metadata")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (existing.status !== "SUCCEEDED") {
      return NextResponse.json(
        { error: "Can only refund succeeded payments" },
        { status: 400 }
      );
    }

    const totalRefund = (existing.refunded_amount_cents || 0) + (refundAmountCents || 0);
    if (totalRefund > existing.amount_cents) {
      return NextResponse.json(
        { error: "Refund amount exceeds payment amount" },
        { status: 400 }
      );
    }

    const newStatus: PaymentStatus =
      totalRefund >= existing.amount_cents ? "REFUNDED" : "PARTIALLY_REFUNDED";

    // Store refund reason in metadata
    const updatedMetadata = {
      ...(existing.metadata || {}),
      refundReason: refundReason || null,
      refundedAt: new Date().toISOString(),
    };

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        refunded_amount_cents: totalRefund,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error processing refund:", updateError);
      return NextResponse.json(
        { error: "Failed to process refund" },
        { status: 500 }
      );
    }

    // Update linked invoice if exists
    if (existing.invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("amount_paid_cents, total_cents")
        .eq("id", existing.invoice_id)
        .single();

      if (invoice) {
        const newPaidCents = Math.max(0, (invoice.amount_paid_cents || 0) - (refundAmountCents || 0));
        const newDueCents = invoice.total_cents - newPaidCents;
        await supabase
          .from("invoices")
          .update({
            amount_paid_cents: newPaidCents,
            amount_due_cents: newDueCents,
            status: newPaidCents <= 0 ? "OPEN" : (newPaidCents >= invoice.total_cents ? "PAID" : "OPEN"),
            paid_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.invoice_id);
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "PAYMENT_REFUNDED",
      entity_type: "PAYMENT",
      entity_id: id,
      details: { refundAmountCents, refundReason, newStatus },
    });

    return NextResponse.json({ payment: updatedPayment });
  } catch (error) {
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
