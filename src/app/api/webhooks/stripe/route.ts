/**
 * Stripe Webhook Handler
 *
 * Processes incoming Stripe webhook events and updates local database.
 * All events are processed idempotently.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/stripe";
import {
  voidFutureJobsForSubscription,
  regenerateJobsForSubscription,
} from "@/lib/subscription-jobs";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Webhook secret for signature verification
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Process the event
    const supabase = getSupabase();

    switch (event.type) {
      // =====================================================
      // SUBSCRIPTION EVENTS
      // =====================================================

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(supabase, subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "customer.subscription.paused": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionPaused(supabase, subscription);
        break;
      }

      case "customer.subscription.resumed": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionResumed(supabase, subscription);
        break;
      }

      // =====================================================
      // INVOICE EVENTS
      // =====================================================

      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceCreated(supabase, invoice);
        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFinalized(supabase, invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceVoided(supabase, invoice);
        break;
      }

      // =====================================================
      // PAYMENT EVENTS
      // =====================================================

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }

      // =====================================================
      // CHECKOUT SESSION EVENTS (for gift certificates)
      // =====================================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, session);
        break;
      }

      // =====================================================
      // CUSTOMER EVENTS
      // =====================================================

      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerUpdated(supabase, customer);
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(
  supabase: ReturnType<typeof getSupabase>,
  subscription: Stripe.Subscription
) {
  const subscriptionId = subscription.metadata?.subscription_id;
  if (!subscriptionId) {
    console.log("No subscription_id in metadata, skipping");
    return;
  }

  // Update local subscription with Stripe ID and status
  const { error } = await supabase
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status: mapStripeSubscriptionStatus(subscription.status),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("Failed to update subscription on create:", error);
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof getSupabase>,
  subscription: Stripe.Subscription
) {
  // Find subscription by Stripe ID or metadata
  const subscriptionId = subscription.metadata?.subscription_id;

  // Determine filter
  const filter = subscriptionId
    ? { id: subscriptionId }
    : { stripe_subscription_id: subscription.id };

  const updates: Record<string, unknown> = {
    status: mapStripeSubscriptionStatus(subscription.status),
  };

  // Handle cancellation
  if (subscription.cancel_at_period_end && subscription.canceled_at) {
    updates.canceled_at = new Date(subscription.canceled_at * 1000).toISOString();
  }

  // Handle pause
  if (subscription.pause_collection) {
    updates.pause_start_date = new Date().toISOString().split("T")[0];
    if (subscription.pause_collection.resumes_at) {
      updates.pause_end_date = new Date(
        subscription.pause_collection.resumes_at * 1000
      )
        .toISOString()
        .split("T")[0];
    }
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updates)
    .match(filter);

  if (error) {
    console.error("Failed to update subscription:", error);
  }
}

/**
 * Handle subscription deleted (canceled) event
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getSupabase>,
  subscription: Stripe.Subscription
) {
  // Get the local subscription to find org_id
  const { data: localSub } = await supabase
    .from("subscriptions")
    .select("id, org_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "CANCELED",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to mark subscription as canceled:", error);
  }

  // Void all future jobs for this subscription
  if (localSub) {
    const voidedCount = await voidFutureJobsForSubscription(
      supabase,
      localSub.id,
      localSub.org_id,
      "Subscription canceled"
    );
    console.log(`Voided ${voidedCount} future jobs for canceled subscription ${localSub.id}`);
  }

  // Also update client status if this was their only subscription
  const clientId = subscription.metadata?.client_id;
  if (clientId) {
    // Check if client has other active subscriptions
    const { data: otherSubs } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "ACTIVE")
      .neq("stripe_subscription_id", subscription.id)
      .limit(1);

    if (!otherSubs || otherSubs.length === 0) {
      await supabase
        .from("clients")
        .update({ status: "CANCELED" })
        .eq("id", clientId);
    }
  }
}

/**
 * Handle subscription paused event
 */
async function handleSubscriptionPaused(
  supabase: ReturnType<typeof getSupabase>,
  subscription: Stripe.Subscription
) {
  // Get the local subscription to find org_id
  const { data: localSub } = await supabase
    .from("subscriptions")
    .select("id, org_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "PAUSED",
      pause_start_date: new Date().toISOString().split("T")[0],
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to mark subscription as paused:", error);
  }

  // Void all future jobs for this subscription
  if (localSub) {
    const voidedCount = await voidFutureJobsForSubscription(
      supabase,
      localSub.id,
      localSub.org_id,
      "Subscription paused"
    );
    console.log(`Voided ${voidedCount} future jobs for paused subscription ${localSub.id}`);
  }
}

/**
 * Handle subscription resumed event
 */
async function handleSubscriptionResumed(
  supabase: ReturnType<typeof getSupabase>,
  subscription: Stripe.Subscription
) {
  // Get the full local subscription for job regeneration
  const { data: localSub } = await supabase
    .from("subscriptions")
    .select("id, org_id, client_id, location_id, frequency, preferred_day, price_per_visit_cents, created_at, status")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "ACTIVE",
      pause_start_date: null,
      pause_end_date: null,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to mark subscription as resumed:", error);
  }

  // Regenerate jobs for the resumed subscription
  if (localSub) {
    // Update the status to ACTIVE for the regeneration function
    const subscriptionForRegen = { ...localSub, status: "ACTIVE" };
    const generatedCount = await regenerateJobsForSubscription(
      supabase,
      subscriptionForRegen,
      localSub.org_id,
      14 // Generate 2 weeks ahead
    );
    console.log(`Generated ${generatedCount} jobs for resumed subscription ${localSub.id}`);
  }
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  if (!invoice.customer) return;

  // Find client by Stripe customer ID
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("stripe_customer_id", invoice.customer)
    .single();

  if (!client) {
    console.log("Client not found for invoice customer:", invoice.customer);
    return;
  }

  // Generate invoice number - find the highest existing number and increment
  const { data: latestInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("org_id", client.org_id)
    .like("invoice_number", "INV-%")
    .order("invoice_number", { ascending: false })
    .limit(1)
    .single();

  let nextNumber = 1;
  if (latestInvoice?.invoice_number) {
    const match = latestInvoice.invoice_number.match(/INV-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`;

  // Calculate discount from invoice (total discount amounts is in newer API)
  const discountCents =
    (invoice as unknown as { total_discount_amounts?: { amount: number }[] })
      .total_discount_amounts?.[0]?.amount || 0;

  // Create local invoice record
  const { error } = await supabase.from("invoices").insert({
    org_id: client.org_id,
    client_id: client.id,
    stripe_invoice_id: invoice.id,
    invoice_number: invoiceNumber,
    status: "DRAFT",
    subtotal_cents: invoice.subtotal || 0,
    discount_cents: discountCents,
    tax_cents: 0, // We don't charge sales tax
    total_cents: invoice.total || 0,
    amount_paid_cents: invoice.amount_paid || 0,
    amount_due_cents: invoice.amount_due || 0,
    due_date: invoice.due_date
      ? new Date(invoice.due_date * 1000).toISOString().split("T")[0]
      : null,
  });

  if (error && !error.message.includes("duplicate")) {
    console.error("Failed to create invoice:", error);
  }
}

/**
 * Handle invoice finalized event
 */
async function handleInvoiceFinalized(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "OPEN",
      subtotal_cents: invoice.subtotal || 0,
      total_cents: invoice.total || 0,
      amount_due_cents: invoice.amount_due || 0,
    })
    .eq("stripe_invoice_id", invoice.id);

  if (error) {
    console.error("Failed to update invoice status to OPEN:", error);
  }
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  // Update invoice status
  const { error: invoiceError } = await supabase
    .from("invoices")
    .update({
      status: "PAID",
      amount_paid_cents: invoice.amount_paid || 0,
      amount_due_cents: 0,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", invoice.id);

  if (invoiceError) {
    console.error("Failed to mark invoice as paid:", invoiceError);
  }

  // Update client status if they were delinquent
  if (invoice.customer) {
    await supabase
      .from("clients")
      .update({ status: "ACTIVE" })
      .eq("stripe_customer_id", invoice.customer)
      .eq("status", "DELINQUENT");
  }

  // Create payment record
  const { data: localInvoice } = await supabase
    .from("invoices")
    .select("id, org_id, client_id")
    .eq("stripe_invoice_id", invoice.id)
    .single();

  // Extract payment_intent (may be expanded or string ID)
  const invoiceAny = invoice as unknown as { payment_intent?: string | { id: string } };
  const paymentIntentId = invoiceAny.payment_intent
    ? typeof invoiceAny.payment_intent === "string"
      ? invoiceAny.payment_intent
      : invoiceAny.payment_intent.id
    : null;

  if (localInvoice && paymentIntentId) {
    const { error: paymentError } = await supabase.from("payments").insert({
      org_id: localInvoice.org_id,
      client_id: localInvoice.client_id,
      invoice_id: localInvoice.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: invoice.amount_paid || 0,
      status: "SUCCEEDED",
      payment_method: "card",
    });

    if (paymentError && !paymentError.message.includes("duplicate")) {
      console.error("Failed to create payment record:", paymentError);
    }
  }
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  // Update local invoice
  await supabase
    .from("invoices")
    .update({ status: "OPEN" })
    .eq("stripe_invoice_id", invoice.id);

  // Extract subscription from invoice (may be expanded or string)
  const invoiceAny = invoice as unknown as {
    subscription?: string | { id: string };
    customer?: string;
  };
  const subscriptionId = invoiceAny.subscription
    ? typeof invoiceAny.subscription === "string"
      ? invoiceAny.subscription
      : invoiceAny.subscription.id
    : null;

  // Mark client as delinquent if subscription invoice
  if (subscriptionId && invoiceAny.customer) {
    await supabase
      .from("clients")
      .update({ status: "DELINQUENT" })
      .eq("stripe_customer_id", invoiceAny.customer);

    await supabase
      .from("subscriptions")
      .update({ status: "PAST_DUE" })
      .eq("stripe_subscription_id", subscriptionId);
  }

  // TODO: Queue payment failed notification
}

/**
 * Handle invoice voided event
 */
async function handleInvoiceVoided(
  supabase: ReturnType<typeof getSupabase>,
  invoice: Stripe.Invoice
) {
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "VOID",
      voided_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", invoice.id);

  if (error) {
    console.error("Failed to mark invoice as voided:", error);
  }
}

/**
 * Handle payment intent succeeded event (one-time payments)
 */
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof getSupabase>,
  paymentIntent: Stripe.PaymentIntent
) {
  // Check if this is already tracked via invoice
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (existingPayment) {
    // Already tracked, just update status
    await supabase
      .from("payments")
      .update({ status: "SUCCEEDED" })
      .eq("stripe_payment_intent_id", paymentIntent.id);
    return;
  }

  // Find client
  if (!paymentIntent.customer) return;

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("stripe_customer_id", paymentIntent.customer)
    .single();

  if (!client) return;

  // Create payment record for one-time payment
  await supabase.from("payments").insert({
    org_id: client.org_id,
    client_id: client.id,
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: paymentIntent.amount,
    status: "SUCCEEDED",
    payment_method: paymentIntent.payment_method_types?.[0] || "card",
    metadata: paymentIntent.metadata,
  });
}

/**
 * Handle payment intent failed event
 */
async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof getSupabase>,
  paymentIntent: Stripe.PaymentIntent
) {
  // Update payment record if exists
  await supabase
    .from("payments")
    .update({
      status: "FAILED",
      failure_reason:
        paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);
}

/**
 * Handle checkout session completed (for gift certificates)
 */
async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof getSupabase>,
  session: Stripe.Checkout.Session
) {
  if (session.metadata?.type !== "gift_certificate") return;

  // Get org (default org for now)
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (!org) {
    console.error("No organization found for gift certificate");
    return;
  }

  // Generate unique code
  const code = generateGiftCertificateCode();
  const amountCents = session.amount_total || 0;

  // Create gift certificate
  const { error } = await supabase.from("gift_certificates").insert({
    org_id: org.id,
    code,
    initial_value_cents: amountCents,
    balance_cents: amountCents,
    status: "ACTIVE",
    purchaser_email: session.customer_details?.email,
    purchaser_name: session.customer_details?.name,
    recipient_name: session.metadata?.recipient_name,
    recipient_email: session.metadata?.recipient_email,
    message: session.metadata?.message,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
  });

  if (error) {
    console.error("Failed to create gift certificate:", error);
    return;
  }

  // TODO: Send gift certificate email to recipient
  console.log(
    `Gift certificate ${code} created for ${session.metadata?.recipient_email}`
  );
}

/**
 * Handle customer updated event
 */
async function handleCustomerUpdated(
  supabase: ReturnType<typeof getSupabase>,
  customer: Stripe.Customer
) {
  const updates: Record<string, unknown> = {};

  if (customer.email) {
    updates.email = customer.email;
  }
  if (customer.phone) {
    updates.phone = customer.phone;
  }
  if (customer.name) {
    const nameParts = customer.name.split(" ");
    updates.first_name = nameParts[0];
    updates.last_name = nameParts.slice(1).join(" ") || null;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("clients")
      .update(updates)
      .eq("stripe_customer_id", customer.id);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Map Stripe subscription status to local status
 */
function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): "ACTIVE" | "PAUSED" | "CANCELED" | "PAST_DUE" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    default:
      return "ACTIVE";
  }
}

/**
 * Generate a unique gift certificate code
 */
function generateGiftCertificateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
