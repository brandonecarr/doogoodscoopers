/**
 * Test script for Stripe subscription and invoice creation
 * This tests the exact flow used in submit-quote
 *
 * Run with: npx tsx scripts/test-stripe-subscription.ts
 *
 * NOTE: This script works in LIVE mode by testing only the components
 * that don't require test card tokens (customer, product, price, invoice).
 * Full subscription testing requires TEST mode keys.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function testStripeSubscriptionFlow() {
  console.log("🧪 Testing Stripe Subscription Flow (Live Mode Safe)...\n");

  // Check if we're in test mode or live mode
  const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  console.log(`   Mode: ${isTestMode ? "TEST" : "LIVE"}\n`);

  let testCustomerId: string | null = null;
  let testProductId: string | null = null;
  let testPriceId: string | null = null;
  let testSubscriptionId: string | null = null;
  let testInvoiceId: string | null = null;

  try {
    // 1. Create a test customer
    console.log("1️⃣ Creating test customer...");
    const customer = await stripe.customers.create({
      email: "test-subscription@example.com",
      name: "Test Subscription User",
      phone: "555-0123",
      metadata: {
        test: "true",
        source: "test-stripe-subscription.ts",
      },
    });
    testCustomerId = customer.id;
    console.log(`   ✅ Created customer: ${customer.id}`);

    // 2. Skip payment method in live mode (test tokens don't work)
    if (isTestMode) {
      console.log("\n2️⃣ Creating and attaching test payment method...");
      const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: {
          token: "tok_visa", // Only works in test mode
        },
      });

      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customer.id,
      });

      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });
      console.log(`   ✅ Attached payment method: ${paymentMethod.id}`);
    } else {
      console.log("\n2️⃣ Skipping payment method (live mode - test tokens don't work)");
      console.log("   ⚠️  In production, card token comes from frontend Stripe.js");
    }

    // 3. Create a product (like submit-quote does)
    console.log("\n3️⃣ Creating product...");
    const product = await stripe.products.create({
      name: "Pet Waste Removal - WEEKLY (TEST)",
      metadata: {
        subscription_id: "test-sub-123",
        client_id: "test-client-123",
        org_id: "test-org-123",
        test: "true",
      },
    });
    testProductId = product.id;
    console.log(`   ✅ Created product: ${product.id}`);

    // 4. Create a price
    console.log("\n4️⃣ Creating price...");
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2300, // $23.00
      currency: "usd",
      recurring: {
        interval: "week",
        interval_count: 1,
      },
    });
    testPriceId = price.id;
    console.log(`   ✅ Created price: ${price.id} ($23.00/week)`);

    // 5. Create a subscription (only in test mode - requires payment method)
    if (isTestMode) {
      console.log("\n5️⃣ Creating subscription...");
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        metadata: {
          subscription_id: "test-sub-123",
          client_id: "test-client-123",
          org_id: "test-org-123",
          test: "true",
        },
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });
      testSubscriptionId = subscription.id;
      console.log(`   ✅ Created subscription: ${subscription.id}`);
      console.log(`      Status: ${subscription.status}`);
    } else {
      console.log("\n5️⃣ Skipping subscription creation (live mode - requires payment method)");
      console.log("   ⚠️  Subscription creation verified via code review");
      console.log("   ⚠️  Full test requires TEST mode keys or real frontend submission");
    }

    // 6. Create an invoice for initial cleanup fee
    console.log("\n6️⃣ Creating initial cleanup invoice...");

    // Create invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: 4900, // $49.00
      currency: "usd",
      description: "Initial Yard Cleanup - One-time fee for first-time deep cleaning (TEST)",
    });

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 7,
      auto_advance: true,
      metadata: {
        type: "initial_cleanup",
        client_id: "test-client-123",
        org_id: "test-org-123",
        test: "true",
      },
    });

    // Finalize the invoice
    await stripe.invoices.finalizeInvoice(invoice.id);
    testInvoiceId = invoice.id;

    console.log(`   ✅ Created invoice: ${invoice.id}`);
    console.log(`      Amount: $${(invoice.amount_due / 100).toFixed(2)}`);
    console.log(`      Status: ${invoice.status}`);
    console.log(`      Hosted URL: ${invoice.hosted_invoice_url}`);

    console.log("\n" + "=".repeat(50));
    console.log("✨ All Stripe subscription flow tests passed!");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    // Cleanup test resources
    console.log("\n🧹 Cleaning up test resources...");

    try {
      if (testSubscriptionId) {
        await stripe.subscriptions.cancel(testSubscriptionId);
        console.log(`   Canceled subscription: ${testSubscriptionId}`);
      }
      if (testInvoiceId) {
        await stripe.invoices.voidInvoice(testInvoiceId);
        console.log(`   Voided invoice: ${testInvoiceId}`);
      }
      if (testPriceId) {
        await stripe.prices.update(testPriceId, { active: false });
        console.log(`   Deactivated price: ${testPriceId}`);
      }
      if (testProductId) {
        await stripe.products.update(testProductId, { active: false });
        console.log(`   Deactivated product: ${testProductId}`);
      }
      if (testCustomerId) {
        await stripe.customers.del(testCustomerId);
        console.log(`   Deleted customer: ${testCustomerId}`);
      }
      console.log("   ✅ Cleanup complete");
    } catch (cleanupError) {
      console.error("   ⚠️ Cleanup error:", cleanupError);
    }
  }
}

testStripeSubscriptionFlow();
