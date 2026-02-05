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
  // Use service role key with explicit options to bypass RLS
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

    // CRITICAL: Check Stripe for existing successful payment BEFORE charging
    // This prevents double-charging if database update previously failed
    const stripe = getStripe();
    try {
      const existingPayments = await stripe.paymentIntents.list({
        customer: client.stripe_customer_id,
        limit: 20,
      });

      const existingSuccessfulPayment = existingPayments.data.find(
        (pi) =>
          pi.status === "succeeded" &&
          pi.metadata?.invoice_id === invoice.id &&
          pi.amount === amountToCharge
      );

      if (existingSuccessfulPayment) {
        console.log(`[CHARGE] Found existing successful payment ${existingSuccessfulPayment.id} for invoice ${invoice.invoice_number}`);
        console.log(`[CHARGE] Attempting to fix invoice ${invoice.id} to PAID status`);

        // Invoice was already paid - fix the database and return
        // Note: Using only id filter since we already verified org ownership,
        // and service role key should bypass RLS
        const { data: fixedRows, error: fixError } = await supabase
          .from("invoices")
          .update({
            status: "PAID",
            amount_paid_cents: invoice.total_cents,
            amount_due_cents: 0,
            paid_at: new Date(existingSuccessfulPayment.created * 1000).toISOString(),
            payment_method: "CREDIT_CARD",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .select("id, status, org_id");

        console.log(`[CHARGE] Fix update result - rows: ${fixedRows?.length || 0}, error: ${fixError?.message || 'none'}`);
        if (fixedRows && fixedRows.length > 0) {
          console.log(`[CHARGE] Fixed row:`, fixedRows[0]);
        }

        if (fixError) {
          console.error("[CHARGE] Failed to fix invoice status:", fixError);
        }

        // Verify the fix worked by reading back
        const { data: verifyInvoice } = await supabase
          .from("invoices")
          .select("id, status, org_id")
          .eq("id", invoice.id)
          .single();
        console.log(`[CHARGE] Verification read:`, verifyInvoice);

        // Create payment record if it doesn't exist
        const { data: existingPaymentRecord } = await supabase
          .from("payments")
          .select("id")
          .eq("stripe_payment_intent_id", existingSuccessfulPayment.id)
          .single();

        if (!existingPaymentRecord) {
          const chargeId = typeof existingSuccessfulPayment.latest_charge === 'string'
            ? existingSuccessfulPayment.latest_charge
            : (existingSuccessfulPayment.latest_charge as { id: string } | null)?.id || null;

          await supabase.from("payments").insert({
            org_id: auth.user.orgId,
            client_id: invoice.client_id,
            invoice_id: invoice.id,
            stripe_payment_intent_id: existingSuccessfulPayment.id,
            stripe_charge_id: chargeId,
            amount_cents: amountToCharge,
            status: "SUCCEEDED",
            payment_method: "CREDIT_CARD",
          });
          console.log(`[CHARGE] Created missing payment record for already-paid invoice ${invoice.id}`);
        }

        return NextResponse.json({
          success: true,
          message: "Invoice was already paid. Status has been updated.",
          paymentIntentId: existingSuccessfulPayment.id,
          status: "succeeded",
          alreadyPaid: true,
          debug: { fixedRows, verifyInvoice },
        });
      }
    } catch (e) {
      console.error("Error checking for existing payments:", e);
      // Continue with charging if check fails
    }
    if (amountToCharge <= 0) {
      return NextResponse.json(
        { error: "No amount to charge" },
        { status: 400 }
      );
    }

    // Get default payment method from Stripe customer
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
      // Update invoice as paid
      // Note: Using only id filter since we already verified org ownership at the start
      console.log(`[CHARGE] Payment succeeded! Updating invoice ${invoice.id} to PAID.`);
      console.log(`[CHARGE] Auth user orgId: ${auth.user.orgId}`);

      const { data: updatedRows, error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "PAID",
          amount_paid_cents: invoice.total_cents,
          amount_due_cents: 0,
          paid_at: new Date().toISOString(),
          payment_method: "CREDIT_CARD",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .select("id, status, org_id");

      console.log(`[CHARGE] Update result - rows: ${JSON.stringify(updatedRows)}, error: ${updateError?.message || 'none'}`);

      if (updateError) {
        console.error("[CHARGE] Update error:", updateError);
        return NextResponse.json({
          success: true,
          warning: "Payment succeeded but invoice status update failed. Please refresh.",
          paymentIntentId: confirmedPayment.id,
          status: confirmedPayment.status,
        });
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error("[CHARGE] No rows updated! Invoice may have wrong org_id.");
        console.error("[CHARGE] Query params - id:", invoice.id, "org_id:", auth.user.orgId);

        // Try to verify what's in the database
        const { data: checkInvoice } = await supabase
          .from("invoices")
          .select("id, org_id, status")
          .eq("id", invoice.id)
          .single();
        console.error("[CHARGE] Actual invoice in DB:", checkInvoice);

        return NextResponse.json({
          success: true,
          warning: "Payment succeeded but invoice status update failed. Please refresh.",
          paymentIntentId: confirmedPayment.id,
          status: confirmedPayment.status,
        });
      }

      const updatedInvoice = updatedRows[0];

      // Verify the status actually changed
      if (updatedInvoice.status !== "PAID") {
        console.error("[CHARGE] Invoice status not updated to PAID. Current status:", updatedInvoice.status);
        return NextResponse.json({
          success: true,
          warning: "Payment succeeded but status may not have updated correctly.",
          paymentIntentId: confirmedPayment.id,
          status: confirmedPayment.status,
        });
      }

      console.log(`[CHARGE] Invoice ${invoice.id} successfully updated to PAID`);

      // Create payment record
      // Get the charge ID from the payment intent for payout tracking
      const chargeId = typeof confirmedPayment.latest_charge === 'string'
        ? confirmedPayment.latest_charge
        : confirmedPayment.latest_charge?.id || null;

      const { error: paymentError } = await supabase.from("payments").insert({
        org_id: auth.user.orgId,
        client_id: invoice.client_id,
        invoice_id: invoice.id,
        stripe_payment_intent_id: confirmedPayment.id,
        stripe_charge_id: chargeId,
        amount_cents: amountToCharge,
        status: "SUCCEEDED",
        payment_method: "CREDIT_CARD",
      });

      if (paymentError) {
        console.error("[CHARGE] Failed to create payment record:", paymentError);
        // Don't fail the request - payment succeeded, just log the error
      } else {
        console.log(`[CHARGE] Payment record created for invoice ${invoice.id}`);
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
      // Mark as failed
      await supabase
        .from("invoices")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

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
