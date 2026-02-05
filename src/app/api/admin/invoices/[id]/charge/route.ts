/**
 * Charge Invoice API
 *
 * POST /api/admin/invoices/[id]/charge - Charge customer's default card for invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import {
  getStripe,
  createPaymentIntent,
  confirmPaymentIntent,
  listPaymentMethods,
} from "@/lib/stripe";
import Stripe from "stripe";

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
    // Fetch invoice with client info
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        status,
        total_cents,
        amount_due_cents,
        client_id,
        client:client_id (
          id,
          first_name,
          last_name,
          stripe_customer_id
        )
      `)
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = invoice.client as any;

    if (!client?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Client does not have a Stripe customer ID" },
        { status: 400 }
      );
    }

    if (invoice.status !== "OPEN" && invoice.status !== "FAILED") {
      return NextResponse.json(
        { error: "Invoice is not in a chargeable state" },
        { status: 400 }
      );
    }

    const amountToCharge = invoice.amount_due_cents || invoice.total_cents;
    if (amountToCharge <= 0) {
      return NextResponse.json(
        { error: "No amount to charge" },
        { status: 400 }
      );
    }

    // Get default payment method from Stripe customer
    const stripe = getStripe();
    let stripeCustomer;
    try {
      stripeCustomer = await stripe.customers.retrieve(client.stripe_customer_id);
    } catch (e) {
      console.error("Failed to retrieve Stripe customer:", e);
      return NextResponse.json(
        { error: "Customer not found in Stripe. The card may need to be re-added." },
        { status: 400 }
      );
    }

    if (stripeCustomer.deleted) {
      return NextResponse.json(
        { error: "Customer has been deleted in Stripe" },
        { status: 400 }
      );
    }

    // Get customer's payment methods to find default
    let paymentMethods;
    try {
      paymentMethods = await listPaymentMethods(client.stripe_customer_id);
    } catch (e) {
      console.error("Failed to list payment methods:", e);
      return NextResponse.json(
        { error: "Failed to retrieve payment methods" },
        { status: 400 }
      );
    }

    if (paymentMethods.length === 0) {
      return NextResponse.json(
        { error: "No payment method on file" },
        { status: 400 }
      );
    }

    const defaultPaymentMethodId =
      stripeCustomer.invoice_settings?.default_payment_method as string | null ||
      paymentMethods[0].id;

    // Create and confirm payment intent
    const paymentIntent = await createPaymentIntent(
      client.stripe_customer_id,
      amountToCharge,
      {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        org_id: auth.user.orgId,
      }
    );

    const confirmedPayment = await confirmPaymentIntent(
      paymentIntent.id,
      defaultPaymentMethodId
    );

    if (confirmedPayment.status === "succeeded") {
      // Update invoice as paid - use select() to verify the update worked
      const { data: updatedInvoice, error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "PAID",
          amount_paid_cents: invoice.total_cents,
          amount_due_cents: 0,
          paid_at: new Date().toISOString(),
          payment_method: "card",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .eq("org_id", auth.user.orgId)
        .select("id, status")
        .single();

      if (updateError || !updatedInvoice) {
        console.error("Failed to update invoice status after successful payment:", updateError);
        console.error("Invoice ID:", invoice.id, "Org ID:", auth.user.orgId);
        // Payment succeeded but DB update failed - return success with warning
        return NextResponse.json({
          success: true,
          warning: "Payment succeeded but invoice status update failed. Please refresh.",
          paymentIntentId: confirmedPayment.id,
          status: confirmedPayment.status,
        });
      }

      // Verify the status actually changed
      if (updatedInvoice.status !== "PAID") {
        console.error("Invoice status not updated to PAID. Current status:", updatedInvoice.status);
        return NextResponse.json({
          success: true,
          warning: "Payment succeeded but status may not have updated correctly.",
          paymentIntentId: confirmedPayment.id,
          status: confirmedPayment.status,
        });
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        org_id: auth.user.orgId,
        user_id: auth.user.id,
        action: "INVOICE_CHARGED",
        entity_type: "INVOICE",
        entity_id: id,
        details: {
          invoiceNumber: invoice.invoice_number,
          amountCents: amountToCharge,
          paymentIntentId: confirmedPayment.id,
        },
      });

      return NextResponse.json({
        success: true,
        paymentIntentId: confirmedPayment.id,
        status: confirmedPayment.status,
      });
    } else if (confirmedPayment.status === "requires_action") {
      return NextResponse.json(
        { error: "Payment requires additional authentication", requiresAction: true },
        { status: 400 }
      );
    } else {
      // Mark as uncollectible
      await supabase
        .from("invoices")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", auth.user.orgId);

      return NextResponse.json(
        { error: `Payment failed: ${confirmedPayment.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error charging invoice:", error);

    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      const stripeError = error as Stripe.errors.StripeError;
      console.error("Stripe error details:", {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
      });

      // Card declined or payment failed
      if (stripeError.type === "StripeCardError") {
        return NextResponse.json(
          { error: stripeError.message || "Card was declined" },
          { status: 400 }
        );
      }

      // Invalid request (e.g., customer doesn't exist)
      if (stripeError.type === "StripeInvalidRequestError") {
        return NextResponse.json(
          { error: stripeError.message || "Invalid payment request" },
          { status: 400 }
        );
      }

      // Return the Stripe error message
      return NextResponse.json(
        { error: stripeError.message || "Payment processing error" },
        { status: 400 }
      );
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Non-Stripe error:", errorMessage);

    return NextResponse.json(
      { error: `Failed to process payment: ${errorMessage}` },
      { status: 500 }
    );
  }
}
