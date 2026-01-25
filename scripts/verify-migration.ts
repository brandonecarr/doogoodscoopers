#!/usr/bin/env npx ts-node
/**
 * Migration Verification Script
 *
 * Verifies data integrity after Sweep&Go migration.
 * Checks for missing data, orphaned records, and Stripe sync issues.
 *
 * Usage:
 *   npx ts-node scripts/verify-migration.ts
 *   npx ts-node scripts/verify-migration.ts --fix
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || "doogoodscoopers";

interface VerificationIssue {
  type: "warning" | "error";
  category: string;
  entity: string;
  entityId: string;
  message: string;
  fixable: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");

  console.log("=".repeat(60));
  console.log("Migration Verification Script");
  console.log("=".repeat(60));
  console.log(`Fix Mode: ${shouldFix}`);
  console.log("");

  // Initialize clients
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

  const issues: VerificationIssue[] = [];

  // ========================================
  // 1. Check Clients
  // ========================================
  console.log("Checking clients...");

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, email, first_name, last_name, stripe_customer_id, sweep_and_go_client_id, status")
    .eq("org_id", DEFAULT_ORG_ID);

  if (clientsError) {
    console.error("Failed to fetch clients:", clientsError);
    process.exit(1);
  }

  console.log(`  Found ${clients?.length || 0} clients`);

  // Check for clients without email
  const clientsWithoutEmail = clients?.filter((c) => !c.email) || [];
  for (const client of clientsWithoutEmail) {
    issues.push({
      type: "error",
      category: "Client Data",
      entity: "Client",
      entityId: client.id,
      message: "Client missing email address",
      fixable: false,
    });
  }

  // Check for duplicate emails
  const emailCounts: Record<string, string[]> = {};
  for (const client of clients || []) {
    if (client.email) {
      const email = client.email.toLowerCase();
      if (!emailCounts[email]) emailCounts[email] = [];
      emailCounts[email].push(client.id);
    }
  }
  for (const [email, ids] of Object.entries(emailCounts)) {
    if (ids.length > 1) {
      issues.push({
        type: "warning",
        category: "Duplicate Data",
        entity: "Client",
        entityId: ids.join(", "),
        message: `Duplicate email: ${email} (${ids.length} clients)`,
        fixable: false,
      });
    }
  }

  // ========================================
  // 2. Check Locations
  // ========================================
  console.log("Checking locations...");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, client_id, address_line1, zip_code")
    .eq("org_id", DEFAULT_ORG_ID);

  console.log(`  Found ${locations?.length || 0} locations`);

  // Check for locations without required fields
  const locationsWithoutAddress = locations?.filter((l) => !l.address_line1 || !l.zip_code) || [];
  for (const location of locationsWithoutAddress) {
    issues.push({
      type: "error",
      category: "Location Data",
      entity: "Location",
      entityId: location.id,
      message: "Location missing address or ZIP code",
      fixable: false,
    });
  }

  // Check for orphaned locations (no matching client)
  const clientIds = new Set(clients?.map((c) => c.id) || []);
  const orphanedLocations = locations?.filter((l) => !clientIds.has(l.client_id)) || [];
  for (const location of orphanedLocations) {
    issues.push({
      type: "error",
      category: "Orphaned Data",
      entity: "Location",
      entityId: location.id,
      message: `Location references non-existent client: ${location.client_id}`,
      fixable: true,
    });
  }

  // ========================================
  // 3. Check Dogs
  // ========================================
  console.log("Checking dogs...");

  const { data: dogs } = await supabase
    .from("dogs")
    .select("id, client_id, name")
    .eq("org_id", DEFAULT_ORG_ID);

  console.log(`  Found ${dogs?.length || 0} dogs`);

  // Check for orphaned dogs
  const orphanedDogs = dogs?.filter((d) => !clientIds.has(d.client_id)) || [];
  for (const dog of orphanedDogs) {
    issues.push({
      type: "error",
      category: "Orphaned Data",
      entity: "Dog",
      entityId: dog.id,
      message: `Dog references non-existent client: ${dog.client_id}`,
      fixable: true,
    });
  }

  // ========================================
  // 4. Check Subscriptions
  // ========================================
  console.log("Checking subscriptions...");

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id, client_id, location_id, stripe_subscription_id, status")
    .eq("org_id", DEFAULT_ORG_ID);

  console.log(`  Found ${subscriptions?.length || 0} subscriptions`);

  const locationIds = new Set(locations?.map((l) => l.id) || []);

  // Check for orphaned subscriptions
  for (const sub of subscriptions || []) {
    if (!clientIds.has(sub.client_id)) {
      issues.push({
        type: "error",
        category: "Orphaned Data",
        entity: "Subscription",
        entityId: sub.id,
        message: `Subscription references non-existent client: ${sub.client_id}`,
        fixable: true,
      });
    }
    if (!locationIds.has(sub.location_id)) {
      issues.push({
        type: "error",
        category: "Orphaned Data",
        entity: "Subscription",
        entityId: sub.id,
        message: `Subscription references non-existent location: ${sub.location_id}`,
        fixable: true,
      });
    }
  }

  // ========================================
  // 5. Check Stripe Sync (if Stripe configured)
  // ========================================
  if (stripe) {
    console.log("Checking Stripe sync...");

    const clientsWithStripe = clients?.filter((c) => c.stripe_customer_id) || [];
    console.log(`  Found ${clientsWithStripe.length} clients with Stripe IDs`);

    let stripeChecked = 0;
    let stripeErrors = 0;

    for (const client of clientsWithStripe.slice(0, 100)) {
      // Limit to 100 for speed
      try {
        await stripe.customers.retrieve(client.stripe_customer_id!);
        stripeChecked++;
      } catch (error) {
        stripeErrors++;
        issues.push({
          type: "error",
          category: "Stripe Sync",
          entity: "Client",
          entityId: client.id,
          message: `Stripe customer not found: ${client.stripe_customer_id}`,
          fixable: false,
        });
      }
    }

    console.log(`  Verified ${stripeChecked} Stripe customers`);
    if (stripeErrors > 0) {
      console.log(`  Found ${stripeErrors} Stripe sync errors`);
    }
  } else {
    console.log("Skipping Stripe check (no API key configured)");
  }

  // ========================================
  // 6. Check Sweep&Go IDs
  // ========================================
  console.log("Checking Sweep&Go migration...");

  const clientsWithSweepGoId = clients?.filter((c) => c.sweep_and_go_client_id) || [];
  console.log(`  Found ${clientsWithSweepGoId.length} clients with Sweep&Go IDs`);

  // Check for duplicate Sweep&Go IDs
  const sweepGoIdCounts: Record<string, string[]> = {};
  for (const client of clientsWithSweepGoId) {
    const id = client.sweep_and_go_client_id!;
    if (!sweepGoIdCounts[id]) sweepGoIdCounts[id] = [];
    sweepGoIdCounts[id].push(client.id);
  }
  for (const [sweepGoId, ids] of Object.entries(sweepGoIdCounts)) {
    if (ids.length > 1) {
      issues.push({
        type: "error",
        category: "Duplicate Data",
        entity: "Client",
        entityId: ids.join(", "),
        message: `Duplicate Sweep&Go ID: ${sweepGoId} (${ids.length} clients)`,
        fixable: false,
      });
    }
  }

  // ========================================
  // 7. Check Active Clients Have Locations
  // ========================================
  console.log("Checking active clients have locations...");

  const activeClients = clients?.filter((c) => c.status === "ACTIVE") || [];
  for (const client of activeClients) {
    const hasLocation = locations?.some((l) => l.client_id === client.id);
    if (!hasLocation) {
      issues.push({
        type: "warning",
        category: "Missing Data",
        entity: "Client",
        entityId: client.id,
        message: `Active client has no location: ${client.email}`,
        fixable: false,
      });
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log("");
  console.log("=".repeat(60));
  console.log("Verification Summary");
  console.log("=".repeat(60));

  const errors = issues.filter((i) => i.type === "error");
  const warnings = issues.filter((i) => i.type === "warning");

  console.log(`Total Issues: ${issues.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log("");

  // Group issues by category
  const byCategory: Record<string, VerificationIssue[]> = {};
  for (const issue of issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = [];
    byCategory[issue.category].push(issue);
  }

  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    console.log(`\n${category} (${categoryIssues.length} issues):`);
    for (const issue of categoryIssues.slice(0, 10)) {
      // Show first 10 per category
      const prefix = issue.type === "error" ? "  [ERROR]" : "  [WARN]";
      console.log(`${prefix} ${issue.entity} ${issue.entityId}: ${issue.message}`);
    }
    if (categoryIssues.length > 10) {
      console.log(`  ... and ${categoryIssues.length - 10} more`);
    }
  }

  // ========================================
  // Fix Issues (if requested)
  // ========================================
  if (shouldFix) {
    const fixableIssues = issues.filter((i) => i.fixable);
    console.log("");
    console.log("=".repeat(60));
    console.log(`Fixing ${fixableIssues.length} fixable issues...`);
    console.log("=".repeat(60));

    // Delete orphaned locations
    const orphanedLocationIds = orphanedLocations.map((l) => l.id);
    if (orphanedLocationIds.length > 0) {
      const { error } = await supabase
        .from("locations")
        .delete()
        .in("id", orphanedLocationIds);

      if (error) {
        console.error(`Failed to delete orphaned locations: ${error.message}`);
      } else {
        console.log(`Deleted ${orphanedLocationIds.length} orphaned locations`);
      }
    }

    // Delete orphaned dogs
    const orphanedDogIds = orphanedDogs.map((d) => d.id);
    if (orphanedDogIds.length > 0) {
      const { error } = await supabase.from("dogs").delete().in("id", orphanedDogIds);

      if (error) {
        console.error(`Failed to delete orphaned dogs: ${error.message}`);
      } else {
        console.log(`Deleted ${orphanedDogIds.length} orphaned dogs`);
      }
    }

    console.log("Fix complete!");
  }

  // Exit with error code if there are errors
  if (errors.length > 0) {
    console.log("");
    console.log("Verification FAILED - errors found");
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log("");
    console.log("Verification PASSED with warnings");
    process.exit(0);
  } else {
    console.log("");
    console.log("Verification PASSED - no issues found");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
