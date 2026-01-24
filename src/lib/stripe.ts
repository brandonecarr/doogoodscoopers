/**
 * Stripe Integration Library
 *
 * Direct Stripe billing integration for DooGoodScoopers.
 * Handles customer creation, subscriptions, invoices, and payment processing.
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Lazy-initialized Stripe client
let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance (lazy initialization)
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * Get Supabase client with service role for database operations
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// =====================================================
// CUSTOMER MANAGEMENT
// =====================================================

export interface CreateStripeCustomerInput {
  clientId: string;
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe customer and link to local client record
 */
export async function createStripeCustomer(
  input: CreateStripeCustomerInput
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const supabase = getSupabase();

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name,
    phone: input.phone,
    metadata: {
      client_id: input.clientId,
      ...input.metadata,
    },
  });

  // Update local client record with Stripe customer ID
  const { error } = await supabase
    .from("clients")
    .update({ stripe_customer_id: customer.id })
    .eq("id", input.clientId);

  if (error) {
    console.error("Failed to update client with Stripe customer ID:", error);
    // Don't throw - customer was created successfully in Stripe
  }

  return customer;
}

/**
 * Get or create a Stripe customer for a client
 */
export async function getOrCreateStripeCustomer(
  clientId: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const supabase = getSupabase();

  // Check if client already has a Stripe customer
  const { data: client, error } = await supabase
    .from("clients")
    .select("stripe_customer_id, email, first_name, last_name, phone")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Return existing customer if linked
  if (client.stripe_customer_id) {
    return await stripe.customers.retrieve(
      client.stripe_customer_id
    ) as Stripe.Customer;
  }

  // Create new customer
  return await createStripeCustomer({
    clientId,
    email: client.email,
    name: [client.first_name, client.last_name].filter(Boolean).join(" "),
    phone: client.phone,
  });
}

/**
 * Update Stripe customer details
 */
export async function updateStripeCustomer(
  stripeCustomerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return await stripe.customers.update(stripeCustomerId, updates);
}

// =====================================================
// SUBSCRIPTION MANAGEMENT
// =====================================================

export interface CreateStripeSubscriptionInput {
  clientId: string;
  subscriptionId: string; // Local subscription ID
  pricePerVisitCents: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  trialDays?: number;
  couponCode?: string;
  metadata?: Record<string, string>;
}

/**
 * Map frequency to Stripe billing interval
 */
function frequencyToInterval(
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY"
): { interval: Stripe.Price.Recurring.Interval; interval_count: number } {
  switch (frequency) {
    case "WEEKLY":
      return { interval: "week", interval_count: 1 };
    case "BIWEEKLY":
      return { interval: "week", interval_count: 2 };
    case "MONTHLY":
      return { interval: "month", interval_count: 1 };
    default:
      return { interval: "month", interval_count: 1 };
  }
}

/**
 * Create a Stripe subscription for a client
 */
export async function createStripeSubscription(
  input: CreateStripeSubscriptionInput
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const supabase = getSupabase();

  // Get or create Stripe customer
  const customer = await getOrCreateStripeCustomer(input.clientId);

  // Create a price for this subscription
  const { interval, interval_count } = frequencyToInterval(input.frequency);

  // First, create a product for this subscription
  const product = await stripe.products.create({
    name: `Pet Waste Removal - ${input.frequency}`,
    metadata: {
      subscription_id: input.subscriptionId,
    },
  });

  // Then create a price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: input.pricePerVisitCents,
    currency: "usd",
    recurring: {
      interval,
      interval_count,
    },
  });

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customer.id,
    items: [
      {
        price: price.id,
      },
    ],
    metadata: {
      subscription_id: input.subscriptionId,
      client_id: input.clientId,
      ...input.metadata,
    },
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.payment_intent"],
  };

  // Add trial period if specified
  if (input.trialDays && input.trialDays > 0) {
    subscriptionParams.trial_period_days = input.trialDays;
  }

  // Add coupon if specified
  if (input.couponCode) {
    subscriptionParams.discounts = [{ coupon: input.couponCode }];
  }

  const subscription = await stripe.subscriptions.create(subscriptionParams);

  // Update local subscription record with Stripe subscription ID
  const { error } = await supabase
    .from("subscriptions")
    .update({ stripe_subscription_id: subscription.id })
    .eq("id", input.subscriptionId);

  if (error) {
    console.error(
      "Failed to update subscription with Stripe subscription ID:",
      error
    );
  }

  return subscription;
}

/**
 * Update a Stripe subscription
 */
export async function updateStripeSubscription(
  stripeSubscriptionId: string,
  updates: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return await stripe.subscriptions.update(stripeSubscriptionId, updates);
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelStripeSubscription(
  stripeSubscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  }
}

/**
 * Pause a Stripe subscription by setting pause_collection
 */
export async function pauseStripeSubscription(
  stripeSubscriptionId: string,
  resumeAt?: Date
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    pause_collection: {
      behavior: "void",
      resumes_at: resumeAt ? Math.floor(resumeAt.getTime() / 1000) : undefined,
    },
  });
}

/**
 * Resume a paused Stripe subscription
 */
export async function resumeStripeSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    pause_collection: "",
  });
}

// =====================================================
// PAYMENT METHODS
// =====================================================

/**
 * Create a SetupIntent for adding a payment method
 */
export async function createSetupIntent(
  stripeCustomerId: string
): Promise<Stripe.SetupIntent> {
  const stripe = getStripe();
  return await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
  });
}

/**
 * List payment methods for a customer
 */
export async function listPaymentMethods(
  stripeCustomerId: string
): Promise<Stripe.PaymentMethod[]> {
  const stripe = getStripe();
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
  });
  return paymentMethods.data;
}

/**
 * Set default payment method for a customer
 */
export async function setDefaultPaymentMethod(
  stripeCustomerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return await stripe.customers.update(stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  }) as Stripe.Customer;
}

/**
 * Detach a payment method from a customer
 */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  const stripe = getStripe();
  return await stripe.paymentMethods.detach(paymentMethodId);
}

// =====================================================
// INVOICES
// =====================================================

/**
 * Create a one-time invoice for a customer
 */
export async function createInvoice(
  stripeCustomerId: string,
  items: Array<{ description: string; amount: number; quantity?: number }>,
  options?: {
    dueDate?: Date;
    autoAdvance?: boolean;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Invoice> {
  const stripe = getStripe();

  // Create invoice items first
  for (const item of items) {
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: item.amount,
      description: item.description,
      quantity: item.quantity || 1,
      currency: "usd",
    });
  }

  // Create the invoice
  const invoiceParams: Stripe.InvoiceCreateParams = {
    customer: stripeCustomerId,
    auto_advance: options?.autoAdvance ?? true,
    collection_method: "charge_automatically",
    metadata: options?.metadata,
  };

  if (options?.dueDate) {
    invoiceParams.due_date = Math.floor(options.dueDate.getTime() / 1000);
    invoiceParams.collection_method = "send_invoice";
  }

  return await stripe.invoices.create(invoiceParams);
}

/**
 * Finalize and send an invoice
 */
export async function finalizeAndSendInvoice(
  invoiceId: string
): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  await stripe.invoices.finalizeInvoice(invoiceId);
  return await stripe.invoices.sendInvoice(invoiceId);
}

/**
 * Pay an invoice immediately
 */
export async function payInvoice(
  invoiceId: string
): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  return await stripe.invoices.pay(invoiceId);
}

/**
 * Void an invoice
 */
export async function voidInvoice(
  invoiceId: string
): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  return await stripe.invoices.voidInvoice(invoiceId);
}

// =====================================================
// ONE-TIME PAYMENTS
// =====================================================

/**
 * Create a PaymentIntent for a one-time charge
 */
export async function createPaymentIntent(
  stripeCustomerId: string,
  amountCents: number,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: stripeCustomerId,
    setup_future_usage: "off_session",
    metadata,
  });
}

/**
 * Confirm a PaymentIntent with a saved payment method
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
}

// =====================================================
// COUPONS AND PROMOTIONS
// =====================================================

export interface CreateStripeCouponInput {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxRedemptions?: number;
  validUntil?: Date;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe coupon
 */
export async function createStripeCoupon(
  input: CreateStripeCouponInput
): Promise<Stripe.Coupon> {
  const stripe = getStripe();

  const couponParams: Stripe.CouponCreateParams = {
    id: input.code,
    metadata: input.metadata,
  };

  if (input.discountType === "PERCENTAGE") {
    couponParams.percent_off = input.discountValue;
  } else {
    couponParams.amount_off = input.discountValue;
    couponParams.currency = "usd";
  }

  if (input.maxRedemptions) {
    couponParams.max_redemptions = input.maxRedemptions;
  }

  if (input.validUntil) {
    couponParams.redeem_by = Math.floor(input.validUntil.getTime() / 1000);
  }

  return await stripe.coupons.create(couponParams);
}

/**
 * Delete a Stripe coupon
 */
export async function deleteStripeCoupon(
  couponCode: string
): Promise<Stripe.DeletedCoupon> {
  const stripe = getStripe();
  return await stripe.coupons.del(couponCode);
}

// =====================================================
// CHECKOUT SESSIONS (for Gift Certificates)
// =====================================================

/**
 * Create a Checkout Session for gift certificate purchase
 */
export async function createGiftCertificateCheckout(
  amountCents: number,
  recipientEmail: string,
  recipientName: string,
  message: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  return await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "DooGoodScoopers Gift Certificate",
            description: `Gift certificate for ${recipientName}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "gift_certificate",
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      message: message.slice(0, 500), // Stripe metadata limit
    },
  });
}

// =====================================================
// WEBHOOK SIGNATURE VERIFICATION
// =====================================================

/**
 * Verify a Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format cents to dollars string
 */
export function formatCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Get a customer's open balance
 */
export async function getCustomerBalance(
  stripeCustomerId: string
): Promise<number> {
  const stripe = getStripe();
  const customer = (await stripe.customers.retrieve(
    stripeCustomerId
  )) as Stripe.Customer;
  return customer.balance || 0;
}

/**
 * Adjust customer balance (positive = credit, negative = charge)
 */
export async function adjustCustomerBalance(
  stripeCustomerId: string,
  amountCents: number,
  description?: string
): Promise<Stripe.CustomerBalanceTransaction> {
  const stripe = getStripe();
  return await stripe.customers.createBalanceTransaction(stripeCustomerId, {
    amount: -amountCents, // Negative in Stripe = credit to customer
    currency: "usd",
    description,
  });
}
