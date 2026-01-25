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

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
type PaymentMethod = "CARD" | "CASH" | "CHECK" | "ACH" | "OTHER";

const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIAL_REFUND"];
const PAYMENT_METHODS: PaymentMethod[] = ["CARD", "CASH", "CHECK", "ACH", "OTHER"];

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
      status,
      payment_method,
      stripe_payment_intent_id,
      reference_number,
      refund_amount_cents,
      refund_reason,
      refunded_at,
      notes,
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
  if (method && PAYMENT_METHODS.includes(method as PaymentMethod)) {
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
    .select("status, amount_cents, refund_amount_cents, payment_method")
    .eq("org_id", auth.user.orgId);

  const completed = allPayments?.filter((p) => p.status === "COMPLETED") || [];
  const refunded = allPayments?.filter((p) => ["REFUNDED", "PARTIAL_REFUND"].includes(p.status)) || [];

  const stats = {
    total: allPayments?.length || 0,
    completed: completed.length,
    pending: allPayments?.filter((p) => p.status === "PENDING").length || 0,
    failed: allPayments?.filter((p) => p.status === "FAILED").length || 0,
    refunded: refunded.length,
    totalCollectedCents: completed.reduce((sum, p) => sum + p.amount_cents, 0),
    totalRefundedCents: refunded.reduce((sum, p) => sum + (p.refund_amount_cents || 0), 0),
    netRevenueCents:
      completed.reduce((sum, p) => sum + p.amount_cents, 0) -
      refunded.reduce((sum, p) => sum + (p.refund_amount_cents || 0), 0),
    byMethod: {
      card: allPayments?.filter((p) => p.payment_method === "CARD" && p.status === "COMPLETED").length || 0,
      cash: allPayments?.filter((p) => p.payment_method === "CASH" && p.status === "COMPLETED").length || 0,
      check: allPayments?.filter((p) => p.payment_method === "CHECK" && p.status === "COMPLETED").length || 0,
      ach: allPayments?.filter((p) => p.payment_method === "ACH" && p.status === "COMPLETED").length || 0,
    },
  };

  // Format payments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedPayments = (payments || []).map((pmt: any) => ({
    id: pmt.id,
    amountCents: pmt.amount_cents,
    status: pmt.status,
    paymentMethod: pmt.payment_method,
    stripePaymentIntentId: pmt.stripe_payment_intent_id,
    referenceNumber: pmt.reference_number,
    refundAmountCents: pmt.refund_amount_cents || 0,
    refundReason: pmt.refund_reason,
    refundedAt: pmt.refunded_at,
    notes: pmt.notes,
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
    if (!clientId || !amountCents || !paymentMethod) {
      return NextResponse.json(
        { error: "Client, amount, and payment method are required" },
        { status: 400 }
      );
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
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
        .select("id, client_id, total_cents, paid_cents")
        .eq("id", invoiceId)
        .eq("org_id", auth.user.orgId)
        .single();

      if (!invoice || invoice.client_id !== clientId) {
        return NextResponse.json({ error: "Invoice not found or doesn't belong to this client" }, { status: 404 });
      }
    }

    // Create payment
    const { data: newPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        invoice_id: invoiceId || null,
        amount_cents: amountCents,
        status: "COMPLETED",
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
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
        .select("total_cents, paid_cents")
        .eq("id", invoiceId)
        .single();

      if (invoice) {
        const newPaidCents = (invoice.paid_cents || 0) + amountCents;
        const newStatus = newPaidCents >= invoice.total_cents ? "PAID" : "PARTIAL";

        await supabase
          .from("invoices")
          .update({
            paid_cents: newPaidCents,
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
      .select("id, amount_cents, status, invoice_id, refund_amount_cents")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (existing.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only refund completed payments" },
        { status: 400 }
      );
    }

    const totalRefund = (existing.refund_amount_cents || 0) + (refundAmountCents || 0);
    if (totalRefund > existing.amount_cents) {
      return NextResponse.json(
        { error: "Refund amount exceeds payment amount" },
        { status: 400 }
      );
    }

    const newStatus: PaymentStatus =
      totalRefund >= existing.amount_cents ? "REFUNDED" : "PARTIAL_REFUND";

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        refund_amount_cents: totalRefund,
        refund_reason: refundReason || null,
        refunded_at: new Date().toISOString(),
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
        .select("paid_cents")
        .eq("id", existing.invoice_id)
        .single();

      if (invoice) {
        const newPaidCents = Math.max(0, (invoice.paid_cents || 0) - (refundAmountCents || 0));
        await supabase
          .from("invoices")
          .update({
            paid_cents: newPaidCents,
            status: newPaidCents <= 0 ? "SENT" : "PARTIAL",
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
