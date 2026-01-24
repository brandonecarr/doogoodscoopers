/**
 * Test script for Stripe integration
 * Run with: npx tsx scripts/test-stripe.ts
 */

import Stripe from "stripe";

async function testStripe() {
  console.log("🧪 Testing Stripe Integration...\n");

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ STRIPE_SECRET_KEY is not configured");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  // Test 1: Verify API connection by listing customers (limited)
  console.log("1️⃣ Testing Stripe API connection...");
  try {
    const customers = await stripe.customers.list({ limit: 1 });
    console.log(`   ✅ Connected! Found ${customers.data.length >= 0 ? "customers" : "no customers yet"}`);
  } catch (error) {
    console.error("   ❌ Failed to connect:", (error as Error).message);
    process.exit(1);
  }

  // Test 2: List products
  console.log("\n2️⃣ Listing existing products...");
  try {
    const products = await stripe.products.list({ limit: 5, active: true });
    console.log(`   ✅ Found ${products.data.length} active products`);
    products.data.forEach((p) => {
      console.log(`      - ${p.name} (${p.id})`);
    });
  } catch (error) {
    console.error("   ❌ Failed:", (error as Error).message);
  }

  // Test 3: List prices
  console.log("\n3️⃣ Listing existing prices...");
  try {
    const prices = await stripe.prices.list({ limit: 5, active: true });
    console.log(`   ✅ Found ${prices.data.length} active prices`);
    prices.data.forEach((p) => {
      const amount = p.unit_amount ? `$${(p.unit_amount / 100).toFixed(2)}` : "N/A";
      console.log(`      - ${amount} ${p.recurring ? `(${p.recurring.interval})` : "(one-time)"}`);
    });
  } catch (error) {
    console.error("   ❌ Failed:", (error as Error).message);
  }

  // Test 4: List coupons
  console.log("\n4️⃣ Listing existing coupons...");
  try {
    const coupons = await stripe.coupons.list({ limit: 5 });
    console.log(`   ✅ Found ${coupons.data.length} coupons`);
    coupons.data.forEach((c) => {
      const discount = c.percent_off
        ? `${c.percent_off}% off`
        : c.amount_off
        ? `$${(c.amount_off / 100).toFixed(2)} off`
        : "N/A";
      console.log(`      - ${c.id}: ${discount}`);
    });
  } catch (error) {
    console.error("   ❌ Failed:", (error as Error).message);
  }

  // Test 5: List subscriptions
  console.log("\n5️⃣ Listing active subscriptions...");
  try {
    const subscriptions = await stripe.subscriptions.list({ limit: 5, status: "active" });
    console.log(`   ✅ Found ${subscriptions.data.length} active subscriptions`);
  } catch (error) {
    console.error("   ❌ Failed:", (error as Error).message);
  }

  // Test 6: Verify webhook secret is configured
  console.log("\n6️⃣ Checking webhook configuration...");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    console.log("   ✅ STRIPE_WEBHOOK_SECRET is configured");
  } else {
    console.log("   ⚠️  STRIPE_WEBHOOK_SECRET is not configured (webhooks won't verify)");
  }

  console.log("\n✨ Stripe integration test complete!");
}

testStripe().catch(console.error);
