/**
 * Check Payment API
 *
 * POST /api/admin/invoices/[id]/check-payment - Record a check payment for invoice
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "invoices:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { amountCents, paymentDate, referenceNumber } = body;

    // Validate required fields
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: "Amount received is required" },
        { status: 400 }
      );
    }

    if (!paymentDate) {
      return NextResponse.json(
        { error: "Payment date is required" },
        { status: 400 }
      );
    }

    if (!referenceNumber) {
      return NextResponse.json(
        { error: "Reference number is required" },
        { status: 400 }
      );
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents, amount_paid_cents, amount_due_cents")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "OPEN" && invoice.status !== "FAILED") {
      return NextResponse.json(
        { error: "Invoice is not in a payable state" },
        { status: 400 }
      );
    }

    // Calculate new amounts
    const currentPaid = invoice.amount_paid_cents || 0;
    const newPaidAmount = currentPaid + amountCents;
    const newAmountDue = invoice.total_cents - newPaidAmount;
    const isFullyPaid = newAmountDue <= 0;

    // Update invoice
    await supabase
      .from("invoices")
      .update({
        status: isFullyPaid ? "PAID" : "OPEN",
        amount_paid_cents: newPaidAmount,
        amount_due_cents: Math.max(0, newAmountDue),
        paid_at: isFullyPaid ? new Date().toISOString() : null,
        payment_method: "check",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CHECK_PAYMENT_RECEIVED",
      entity_type: "INVOICE",
      entity_id: id,
      details: {
        invoiceNumber: invoice.invoice_number,
        amountCents,
        paymentDate,
        referenceNumber,
        fullyPaid: isFullyPaid,
      },
    });

    return NextResponse.json({
      success: true,
      fullyPaid: isFullyPaid,
      newAmountDue: Math.max(0, newAmountDue),
    });
  } catch (error) {
    console.error("Error recording check payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
