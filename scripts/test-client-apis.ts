/**
 * Test Client Portal APIs
 *
 * Usage:
 *   npx tsx scripts/test-client-apis.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const testEmail = "testclient@doogoodscoopers.com";
const testPassword = "clientpass123!";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "FAIL", details: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

async function fetchAPI(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status}: ${data.error || JSON.stringify(data)}`);
  }
  return data;
}

async function runTests() {
  console.log("\n═══════════════════════════════════════════");
  console.log("Testing Client Portal APIs");
  console.log("═══════════════════════════════════════════\n");

  // Sign in
  console.log("Signing in as test client...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authError || !authData.session) {
    console.error("Failed to sign in:", authError?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log("✓ Signed in successfully\n");

  // Test Dashboard API
  await test("GET /api/client/dashboard", async () => {
    const data = await fetchAPI("/api/client/dashboard", token);
    if (!data.client) throw new Error("Missing client data");
    if (typeof data.client.firstName !== "string") throw new Error("Invalid client data");
  });

  // Test Schedule API
  await test("GET /api/client/schedule (upcoming)", async () => {
    const data = await fetchAPI("/api/client/schedule?view=upcoming", token);
    if (!Array.isArray(data.jobs)) throw new Error("Missing jobs array");
    if (!data.pagination) throw new Error("Missing pagination");
  });

  await test("GET /api/client/schedule (past)", async () => {
    const data = await fetchAPI("/api/client/schedule?view=past", token);
    if (!Array.isArray(data.jobs)) throw new Error("Missing jobs array");
  });

  // Test Billing API
  await test("GET /api/client/billing", async () => {
    const data = await fetchAPI("/api/client/billing", token);
    if (!Array.isArray(data.invoices)) throw new Error("Missing invoices array");
    if (!Array.isArray(data.payments)) throw new Error("Missing payments array");
    if (!data.totals) throw new Error("Missing totals");
  });

  // Test Profile API
  await test("GET /api/client/profile", async () => {
    const data = await fetchAPI("/api/client/profile", token);
    if (!data.profile) throw new Error("Missing profile data");
    if (!Array.isArray(data.locations)) throw new Error("Missing locations array");
    if (!Array.isArray(data.dogs)) throw new Error("Missing dogs array");
  });

  // Test Subscription API
  await test("GET /api/client/subscription", async () => {
    const data = await fetchAPI("/api/client/subscription", token);
    // subscription can be null if no active subscription
    if (data.subscription && !data.subscription.id) {
      throw new Error("Invalid subscription data");
    }
  });

  // Test Referrals API
  await test("GET /api/client/referrals", async () => {
    const data = await fetchAPI("/api/client/referrals", token);
    if (!data.stats) throw new Error("Missing stats object");
    if (typeof data.stats.totalReferrals !== "number") throw new Error("Missing totalReferrals");
    if (typeof data.referralCode !== "string") throw new Error("Missing referralCode");
  });

  // Test Locations API
  await test("GET /api/client/locations", async () => {
    const data = await fetchAPI("/api/client/locations", token);
    if (!Array.isArray(data.locations)) throw new Error("Missing locations array");
  });

  // Test Dogs API
  await test("GET /api/client/dogs", async () => {
    const data = await fetchAPI("/api/client/dogs", token);
    if (!Array.isArray(data.dogs)) throw new Error("Missing dogs array");
  });

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("Test Results Summary");
  console.log("═══════════════════════════════════════════\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`  - ${r.name}: ${r.details}`));
  }

  console.log("\n");

  // Sign out
  await supabase.auth.signOut();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
