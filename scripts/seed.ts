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

  // 6. Create Public Metrics Cache
  console.log("6. Creating public metrics cache...");
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
