/**
 * Seed script for DooGoodScoopers Operations Platform
 *
 * This script creates:
 * 1. Initial organization
 * 2. Owner user account (via Supabase Auth)
 * 3. Default notification templates
 * 4. Default service plans and pricing rules
 * 5. Referral program settings
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Required environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Configuration
const config = {
  organization: {
    name: "DooGoodScoopers",
    slug: "doogoodscoopers",
    phone: "(951) 203-0331",
    email: "service@doogoodscoopers.com",
    website: "https://doogoodscoopers.com",
    address: {
      city: "Moreno Valley",
      state: "CA",
      country: "US",
    },
    timezone: "America/Los_Angeles",
    primaryColor: "#14b8a6",
    secondaryColor: "#002842",
  },
  owner: {
    email: process.env.OWNER_EMAIL || "service@doogoodscoopers.com",
    password: process.env.OWNER_PASSWORD || "changeme123!",
    firstName: "Brandon",
    lastName: "Carr",
  },
};

async function seed() {
  console.log("🌱 Starting seed...\n");

  // 1. Create Organization
  console.log("1. Creating organization...");
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .upsert(
      {
        name: config.organization.name,
        slug: config.organization.slug,
        phone: config.organization.phone,
        email: config.organization.email,
        website: config.organization.website,
        address: config.organization.address,
        timezone: config.organization.timezone,
        primary_color: config.organization.primaryColor,
        secondary_color: config.organization.secondaryColor,
        settings: {
          requireCardOnFile: true,
          allowPayByCheck: false,
          defaultCurrency: "usd",
          autoGenerateJobsDaysAhead: 7,
          abandonedSessionTimeoutMinutes: 30,
          remarketingEnabled: true,
          remarketingMaxMessages: 3,
        },
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (orgError) {
    console.error("Failed to create organization:", orgError);
    process.exit(1);
  }
  console.log(`   ✓ Organization created: ${org.name} (${org.id})\n`);

  // 2. Create Owner User
  console.log("2. Creating owner user...");

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === config.owner.email
  );

  let userId: string;

  if (existingUser) {
    console.log(`   → User already exists: ${existingUser.email}`);
    userId = existingUser.id;
  } else {
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: config.owner.email,
        password: config.owner.password,
        email_confirm: true,
        user_metadata: {
          first_name: config.owner.firstName,
          last_name: config.owner.lastName,
        },
      });

    if (authError) {
      console.error("Failed to create auth user:", authError);
      process.exit(1);
    }
    userId = authUser.user.id;
    console.log(`   ✓ Auth user created: ${config.owner.email}`);
  }

  // Create or update user profile
  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      org_id: org.id,
      email: config.owner.email,
      role: "OWNER",
      first_name: config.owner.firstName,
      last_name: config.owner.lastName,
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Failed to create user profile:", profileError);
    process.exit(1);
  }
  console.log(`   ✓ User profile created/updated\n`);

  // 3. Create Default Service Plans
  console.log("3. Creating service plans...");
  const servicePlans = [
    { name: "Weekly Service", frequency: "WEEKLY", is_default: true, sort_order: 1 },
    { name: "Bi-Weekly Service", frequency: "BIWEEKLY", is_default: false, sort_order: 2 },
    { name: "Monthly Service", frequency: "MONTHLY", is_default: false, sort_order: 3 },
    { name: "One-Time Cleanup", frequency: "ONETIME", is_default: false, sort_order: 4 },
  ];

  for (const plan of servicePlans) {
    const { error } = await supabase.from("service_plans").upsert(
      {
        org_id: org.id,
        ...plan,
        is_active: true,
      },
      { onConflict: "org_id,name", ignoreDuplicates: true }
    );

    if (error && !error.message.includes("duplicate")) {
      console.error(`   ✗ Failed to create plan ${plan.name}:`, error);
    } else {
      console.log(`   ✓ ${plan.name}`);
    }
  }
  console.log("");

  // 4. Create Default Notification Templates
  console.log("4. Creating notification templates...");
  const templates = [
    {
      type: "ON_THE_WAY",
      channel: "SMS",
      name: "On The Way SMS",
      body: "Hi {{client_first_name}}! DooGoodScoopers is on the way to service your yard. We'll be there in approximately {{eta_minutes}} minutes. 🐾",
    },
    {
      type: "DAY_AHEAD",
      channel: "SMS",
      name: "Day Ahead Reminder SMS",
      body: "Hi {{client_first_name}}! Just a reminder that DooGoodScoopers will be servicing your yard tomorrow. Please ensure gates are unlocked. 🐕",
    },
    {
      type: "COMPLETED",
      channel: "SMS",
      name: "Service Completed SMS",
      body: "Hi {{client_first_name}}! We've finished cleaning your yard today. Your pup can enjoy a fresh, clean space! 🐾✨",
    },
    {
      type: "SKIPPED",
      channel: "SMS",
      name: "Service Skipped SMS",
      body: "Hi {{client_first_name}}! We were unable to complete your service today: {{skip_reason}}. We'll be back on your next scheduled date.",
    },
    {
      type: "PAYMENT_FAILED",
      channel: "SMS",
      name: "Payment Failed SMS",
      body: "Hi {{client_first_name}}, we had trouble processing your payment. Please update your payment method at {{portal_link}} to avoid service interruption.",
    },
    {
      type: "WELCOME",
      channel: "EMAIL",
      name: "Welcome Email",
      subject: "Welcome to DooGoodScoopers! 🐾",
      body: `Hi {{client_first_name}},

Welcome to the DooGoodScoopers family! We're excited to help keep your yard clean and your pups happy.

Your service details:
- Frequency: {{frequency}}
- Price: {{price_per_visit}}
- First service date: {{next_service_date}}

If you have any questions, don't hesitate to reach out!

Best,
The DooGoodScoopers Team`,
    },
    {
      type: "REMARKETING_SMS",
      channel: "SMS",
      name: "Abandoned Cart Follow-up SMS",
      body: "Hi {{contact_name}}! We noticed you started signing up for DooGoodScoopers but didn't finish. Ready to get that yard cleaned? Complete your signup at {{resume_link}} 🐕",
    },
    {
      type: "REMARKETING_EMAIL",
      channel: "EMAIL",
      name: "Abandoned Cart Follow-up Email",
      subject: "Your DooGoodScoopers signup is waiting! 🐾",
      body: `Hi {{contact_name}},

We noticed you started signing up for our pooper scooper service but didn't complete your registration.

Here's what you'll get:
- Professional yard cleaning
- Reliable, scheduled service
- A happier, healthier yard for your pup

Ready to finish? Click here: {{resume_link}}

If you have any questions, we're here to help!

Best,
The DooGoodScoopers Team`,
    },
  ];

  for (const template of templates) {
    const { error } = await supabase.from("notification_templates").upsert(
      {
        org_id: org.id,
        ...template,
        is_enabled: true,
        variables: [],
      },
      { onConflict: "org_id,type,channel", ignoreDuplicates: true }
    );

    if (error && !error.message.includes("duplicate")) {
      console.error(`   ✗ Failed to create template ${template.name}:`, error);
    } else {
      console.log(`   ✓ ${template.name}`);
    }
  }
  console.log("");

  // 5. Create Referral Program Settings
  console.log("5. Creating referral program settings...");
  const { error: referralError } = await supabase
    .from("referral_program_settings")
    .upsert(
      {
        org_id: org.id,
        is_enabled: true,
        reward_referrer_cents: 2500,
        reward_referee_cents: 2500,
        reward_type: "ACCOUNT_CREDIT",
        terms: "Both the referrer and new customer receive $25 credit after the new customer completes their first paid service.",
      },
      { onConflict: "org_id" }
    );

  if (referralError) {
    console.error("   ✗ Failed to create referral settings:", referralError);
  } else {
    console.log("   ✓ Referral program configured ($25 credit each)\n");
  }

  // 6. Create Pricing Rules
  console.log("6. Creating pricing rules...");

  // Get service plan IDs
  const { data: plans } = await supabase
    .from("service_plans")
    .select("id, frequency")
    .eq("org_id", org.id);

  const planMap = new Map(plans?.map((p) => [p.frequency, p.id]) || []);

  // Service area ZIP codes (Inland Empire area)
  const serviceAreaZips = [
    "91701", "91708", "91709", "91710", "91711", "91730", "91737", "91739", // Rancho Cucamonga area
    "91761", "91762", "91763", "91764", "91765", "91766", "91767", "91768", // Ontario/Pomona area
    "91784", "91785", "91786", "91789", // Claremont/Upland area
    "92316", "92324", "92335", "92336", "92337", // Fontana/Rialto area
    "92501", "92503", "92504", "92505", "92506", "92507", "92508", "92509", // Riverside area
    "92860", "92879", "92880", "92881", "92882", "92883", // Corona/Norco area
    "91752", // Eastvale
    "91701", "91702", "91706", "91711", "91750", // Diamond Bar/Chino Hills
    "92313", "92346", "92354", "92399", "92404", "92405", "92407", "92408", // San Bernardino area
    "92374", "92376", "92377", // Redlands/Highland area
  ];

  // Pricing structure:
  // Weekly: $18/visit for 1 dog, +$5 per additional dog
  // Bi-Weekly: $22/visit for 1 dog, +$6 per additional dog
  // Monthly: $45/visit for 1 dog, +$10 per additional dog
  // One-Time: $65 base, +$15 per additional dog
  const pricingRules = [
    // Weekly pricing
    {
      name: "Weekly - 1 Dog",
      frequency: "WEEKLY",
      min_dogs: 1,
      max_dogs: 1,
      base_price_cents: 1800,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Weekly - 2 Dogs",
      frequency: "WEEKLY",
      min_dogs: 2,
      max_dogs: 2,
      base_price_cents: 2300,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Weekly - 3 Dogs",
      frequency: "WEEKLY",
      min_dogs: 3,
      max_dogs: 3,
      base_price_cents: 2800,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Weekly - 4+ Dogs",
      frequency: "WEEKLY",
      min_dogs: 4,
      max_dogs: 99,
      base_price_cents: 2800,
      per_dog_price_cents: 500,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    // Bi-Weekly pricing
    {
      name: "Bi-Weekly - 1 Dog",
      frequency: "BIWEEKLY",
      min_dogs: 1,
      max_dogs: 1,
      base_price_cents: 2200,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Bi-Weekly - 2 Dogs",
      frequency: "BIWEEKLY",
      min_dogs: 2,
      max_dogs: 2,
      base_price_cents: 2800,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Bi-Weekly - 3 Dogs",
      frequency: "BIWEEKLY",
      min_dogs: 3,
      max_dogs: 3,
      base_price_cents: 3400,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Bi-Weekly - 4+ Dogs",
      frequency: "BIWEEKLY",
      min_dogs: 4,
      max_dogs: 99,
      base_price_cents: 3400,
      per_dog_price_cents: 600,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    // Monthly pricing
    {
      name: "Monthly - 1 Dog",
      frequency: "MONTHLY",
      min_dogs: 1,
      max_dogs: 1,
      base_price_cents: 4500,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Monthly - 2 Dogs",
      frequency: "MONTHLY",
      min_dogs: 2,
      max_dogs: 2,
      base_price_cents: 5500,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Monthly - 3 Dogs",
      frequency: "MONTHLY",
      min_dogs: 3,
      max_dogs: 3,
      base_price_cents: 6500,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "Monthly - 4+ Dogs",
      frequency: "MONTHLY",
      min_dogs: 4,
      max_dogs: 99,
      base_price_cents: 6500,
      per_dog_price_cents: 1000,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    // One-Time pricing
    {
      name: "One-Time - 1 Dog",
      frequency: "ONETIME",
      min_dogs: 1,
      max_dogs: 1,
      base_price_cents: 6500,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "One-Time - 2 Dogs",
      frequency: "ONETIME",
      min_dogs: 2,
      max_dogs: 2,
      base_price_cents: 8000,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "One-Time - 3 Dogs",
      frequency: "ONETIME",
      min_dogs: 3,
      max_dogs: 3,
      base_price_cents: 9500,
      per_dog_price_cents: 0,
      initial_cleanup_cents: 0,
      priority: 10,
    },
    {
      name: "One-Time - 4+ Dogs",
      frequency: "ONETIME",
      min_dogs: 4,
      max_dogs: 99,
      base_price_cents: 9500,
      per_dog_price_cents: 1500,
      initial_cleanup_cents: 0,
      priority: 10,
    },
  ];

  // Check if pricing rules already exist
  const { data: existingRules } = await supabase
    .from("pricing_rules")
    .select("name")
    .eq("org_id", org.id);
  const existingRuleNames = new Set(existingRules?.map((r) => r.name) || []);

  for (const rule of pricingRules) {
    if (existingRuleNames.has(rule.name)) {
      console.log(`   → ${rule.name} (already exists)`);
      continue;
    }

    const planId = planMap.get(rule.frequency);
    const { error } = await supabase.from("pricing_rules").insert({
      org_id: org.id,
      plan_id: planId,
      name: rule.name,
      zip_codes: serviceAreaZips,
      frequency: rule.frequency,
      min_dogs: rule.min_dogs,
      max_dogs: rule.max_dogs,
      base_price_cents: rule.base_price_cents,
      per_dog_price_cents: rule.per_dog_price_cents,
      initial_cleanup_cents: rule.initial_cleanup_cents,
      priority: rule.priority,
      is_active: true,
    });

    if (error) {
      console.error(`   ✗ Failed to create rule ${rule.name}:`, error);
    } else {
      console.log(`   ✓ ${rule.name}`);
    }
  }
  console.log("");

  // 7. Create Add-ons
  console.log("7. Creating add-ons...");
  const addOns = [
    {
      name: "Initial Cleanup - Light",
      description: "For yards cleaned within the last 2 weeks",
      price_cents: 0,
      price_type: "FIXED",
      is_recurring: false,
      sort_order: 1,
    },
    {
      name: "Initial Cleanup - Moderate",
      description: "For yards not cleaned in 2-4 weeks",
      price_cents: 4900,
      price_type: "FIXED",
      is_recurring: false,
      sort_order: 2,
    },
    {
      name: "Initial Cleanup - Heavy",
      description: "For yards not cleaned in 1-2 months",
      price_cents: 9900,
      price_type: "FIXED",
      is_recurring: false,
      sort_order: 3,
    },
    {
      name: "Initial Cleanup - Deep",
      description: "For yards not cleaned in 3+ months",
      price_cents: 14900,
      price_type: "FIXED",
      is_recurring: false,
      sort_order: 4,
    },
    {
      name: "Deodorizing Treatment",
      description: "Pet-safe deodorizing spray for your yard",
      price_cents: 1500,
      price_type: "PER_VISIT",
      is_recurring: true,
      sort_order: 10,
    },
    {
      name: "Brown Spot Treatment",
      description: "Enzyme treatment for brown spots",
      price_cents: 2000,
      price_type: "PER_VISIT",
      is_recurring: true,
      sort_order: 11,
    },
  ];

  // Check if add-ons already exist
  const { data: existingAddOns } = await supabase
    .from("add_ons")
    .select("name")
    .eq("org_id", org.id);
  const existingAddOnNames = new Set(existingAddOns?.map((a) => a.name) || []);

  for (const addOn of addOns) {
    if (existingAddOnNames.has(addOn.name)) {
      console.log(`   → ${addOn.name} (already exists)`);
      continue;
    }

    const { error } = await supabase.from("add_ons").insert({
      org_id: org.id,
      ...addOn,
      is_active: true,
    });

    if (error) {
      console.error(`   ✗ Failed to create add-on ${addOn.name}:`, error);
    } else {
      console.log(`   ✓ ${addOn.name}`);
    }
  }
  console.log("");

  // 8. Create Public Metrics Cache
  console.log("8. Creating public metrics cache...");
  const { error: metricsError } = await supabase
    .from("public_metrics_cache")
    .upsert(
      {
        org_id: org.id,
        satisfied_customers: 521,
        happy_pets: 1840,
        completed_yards: 22123,
        five_star_reviews: 127,
      },
      { onConflict: "org_id" }
    );

  if (metricsError) {
    console.error("   ✗ Failed to create metrics cache:", metricsError);
  } else {
    console.log("   ✓ Public metrics initialized\n");
  }

  console.log("═══════════════════════════════════════════");
  console.log("🎉 Seed completed successfully!");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log("Owner Login:");
  console.log(`  Email: ${config.owner.email}`);
  console.log(`  Password: ${config.owner.password}`);
  console.log("");
  console.log("⚠️  IMPORTANT: Change the owner password after first login!");
  console.log("");
}

seed().catch(console.error);
