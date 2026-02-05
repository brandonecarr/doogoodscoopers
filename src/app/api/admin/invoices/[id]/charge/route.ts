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

    if (invoice.status !== "OPEN" && invoice.status !== "UNCOLLECTIBLE") {
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

    // Get customer's payment methods to find default
    const paymentMethods = await listPaymentMethods(client.stripe_customer_id);

    if (paymentMethods.length === 0) {
      return NextResponse.json(
        { error: "No payment method on file" },
        { status: 400 }
      );
    }

    // Get default payment method from Stripe customer
    const stripe = getStripe();
    const stripeCustomer = await stripe.customers.retrieve(client.stripe_customer_id);

    if (stripeCustomer.deleted) {
      return NextResponse.json(
        { error: "Customer has been deleted in Stripe" },
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
      await supabase
        .from("invoices")
        .update({
          status: "PAID",
          amount_paid_cents: invoice.total_cents,
          amount_due_cents: 0,
          paid_at: new Date().toISOString(),
          payment_method: "card",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

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
          status: "UNCOLLECTIBLE",
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

    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { error: error.message || "Card was declined" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
