#!/usr/bin/env npx ts-node
/**
 * Sweep&Go Migration Script
 *
 * Imports customer data from Sweep&Go CSV export into the new system.
 *
 * Usage:
 *   npx ts-node scripts/migrate-sweepandgo.ts --file customers.csv --dry-run
 *   npx ts-node scripts/migrate-sweepandgo.ts --file customers.csv
 *
 * Expected CSV format (from Sweep&Go export):
 *   client_id, first_name, last_name, email, phone, address, city, state, zip,
 *   gate_code, gate_location, dog_count, dog_names, frequency, status,
 *   stripe_customer_id, created_at
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || "doogoodscoopers";

interface SweepAndGoCustomer {
  client_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  gate_code?: string;
  gate_location?: string;
  dog_count?: string;
  dog_names?: string;
  frequency?: string;
  status?: string;
  stripe_customer_id?: string;
  created_at?: string;
}

interface MigrationResult {
  clientId: string;
  sweepAndGoId: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
}

// Map Sweep&Go frequency to our format
const frequencyMap: Record<string, string> = {
  weekly: "WEEKLY",
  once_a_week: "WEEKLY",
  "bi-weekly": "BIWEEKLY",
  biweekly: "BIWEEKLY",
  bi_weekly: "BIWEEKLY",
  monthly: "MONTHLY",
  once_a_month: "MONTHLY",
  "one-time": "ONETIME",
  one_time: "ONETIME",
  onetime: "ONETIME",
};

// Map Sweep&Go status to our format
const statusMap: Record<string, string> = {
  active: "ACTIVE",
  paused: "PAUSED",
  cancelled: "CANCELED",
  canceled: "CANCELED",
  suspended: "PAUSED",
  inactive: "CANCELED",
};

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const dryRun = args.includes("--dry-run");
  const skipExisting = args.includes("--skip-existing");

  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error("Usage: npx ts-node scripts/migrate-sweepandgo.ts --file <csv-file> [--dry-run] [--skip-existing]");
    process.exit(1);
  }

  const csvFile = args[fileIndex + 1];

  if (!fs.existsSync(csvFile)) {
    console.error(`File not found: ${csvFile}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Sweep&Go Migration Script");
  console.log("=".repeat(60));
  console.log(`CSV File: ${csvFile}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Skip Existing: ${skipExisting}`);
  console.log("");

  // Initialize Supabase
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read and parse CSV
  const csvContent = fs.readFileSync(csvFile, "utf-8");
  const records: SweepAndGoCustomer[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Found ${records.length} customers to import`);
  console.log("");

  const results: MigrationResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i++) {
    const customer = records[i];
    const progress = `[${i + 1}/${records.length}]`;

    try {
      // Check if customer already exists by Sweep&Go ID
      const { data: existing } = await supabase
        .from("clients")
        .select("id, sweep_and_go_client_id")
        .eq("sweep_and_go_client_id", customer.client_id)
        .single();

      if (existing && skipExisting) {
        console.log(`${progress} SKIP: ${customer.email} (already exists)`);
        results.push({
          clientId: existing.id,
          sweepAndGoId: customer.client_id,
          status: "skipped",
          message: "Already exists",
        });
        skipped++;
        continue;
      }

      // Check if customer exists by email
      const { data: existingByEmail } = await supabase
        .from("clients")
        .select("id, sweep_and_go_client_id")
        .eq("email", customer.email.toLowerCase())
        .eq("org_id", DEFAULT_ORG_ID)
        .single();

      if (existingByEmail) {
        if (dryRun) {
          console.log(`${progress} WOULD UPDATE: ${customer.email} (link Sweep&Go ID)`);
        } else {
          // Update existing client with Sweep&Go ID
          await supabase
            .from("clients")
            .update({
              sweep_and_go_client_id: customer.client_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingByEmail.id);

          console.log(`${progress} UPDATED: ${customer.email} (linked Sweep&Go ID)`);
        }
        results.push({
          clientId: existingByEmail.id,
          sweepAndGoId: customer.client_id,
          status: "updated",
          message: "Linked Sweep&Go ID to existing customer",
        });
        updated++;
        continue;
      }

      // Create new client
      const clientData = {
        org_id: DEFAULT_ORG_ID,
        sweep_and_go_client_id: customer.client_id,
        stripe_customer_id: customer.stripe_customer_id || null,
        first_name: customer.first_name,
        last_name: customer.last_name || null,
        email: customer.email.toLowerCase(),
        phone: customer.phone || null,
        status: statusMap[customer.status?.toLowerCase() || "active"] || "ACTIVE",
        client_type: "RESIDENTIAL",
        notification_preferences: {
          email: true,
          sms: !!customer.phone,
        },
        created_at: customer.created_at || new Date().toISOString(),
      };

      if (dryRun) {
        console.log(`${progress} WOULD CREATE: ${customer.email}`);
        results.push({
          clientId: "dry-run",
          sweepAndGoId: customer.client_id,
          status: "created",
          message: "Would be created",
        });
        created++;
        continue;
      }

      // Insert client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert(clientData)
        .select()
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      // Create location
      const locationData = {
        org_id: DEFAULT_ORG_ID,
        client_id: newClient.id,
        address_line1: customer.address,
        city: customer.city,
        state: customer.state || "CA",
        zip_code: customer.zip,
        country: "US",
        gate_code: customer.gate_code || null,
        gate_location: customer.gate_location || null,
        is_primary: true,
        is_active: true,
      };

      const { data: newLocation, error: locationError } = await supabase
        .from("locations")
        .insert(locationData)
        .select()
        .single();

      if (locationError) {
        console.warn(`  Warning: Failed to create location: ${locationError.message}`);
      }

      // Create dogs if provided
      if (customer.dog_names && customer.dog_count) {
        const dogNames = customer.dog_names.split(",").map((n) => n.trim());
        for (const dogName of dogNames) {
          if (dogName) {
            await supabase.from("dogs").insert({
              org_id: DEFAULT_ORG_ID,
              client_id: newClient.id,
              location_id: newLocation?.id || null,
              name: dogName,
              is_safe: true,
              is_active: true,
            });
          }
        }
      } else if (customer.dog_count) {
        // Create placeholder dogs
        const count = parseInt(customer.dog_count, 10) || 1;
        for (let d = 0; d < count; d++) {
          await supabase.from("dogs").insert({
            org_id: DEFAULT_ORG_ID,
            client_id: newClient.id,
            location_id: newLocation?.id || null,
            name: `Dog ${d + 1}`,
            is_safe: true,
            is_active: true,
          });
        }
      }

      // Create subscription if frequency is provided and status is active
      if (customer.frequency && customer.status?.toLowerCase() === "active" && newLocation) {
        const frequency = frequencyMap[customer.frequency.toLowerCase()] || "WEEKLY";

        // Get default service plan
        const { data: plan } = await supabase
          .from("service_plans")
          .select("id")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (plan) {
          await supabase.from("subscriptions").insert({
            org_id: DEFAULT_ORG_ID,
            client_id: newClient.id,
            location_id: newLocation.id,
            plan_id: plan.id,
            frequency,
            status: "ACTIVE",
            price_per_visit_cents: 0, // Will need to be updated with actual pricing
          });
        }
      }

      console.log(`${progress} CREATED: ${customer.email}`);
      results.push({
        clientId: newClient.id,
        sweepAndGoId: customer.client_id,
        status: "created",
      });
      created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`${progress} ERROR: ${customer.email} - ${message}`);
      results.push({
        clientId: "",
        sweepAndGoId: customer.client_id,
        status: "error",
        message,
      });
      errors++;
    }
  }

  // Summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total Processed: ${records.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log("");

  if (dryRun) {
    console.log("This was a DRY RUN - no changes were made.");
    console.log("Run without --dry-run to perform the actual migration.");
  }

  // Write results to file
  const resultsFile = path.join(
    path.dirname(csvFile),
    `migration-results-${Date.now()}.json`
  );
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results written to: ${resultsFile}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
