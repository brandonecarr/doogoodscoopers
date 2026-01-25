/**
 * Create a Test Client User
 *
 * Usage:
 *   npx tsx scripts/create-test-client.ts
 *
 * Or with custom email/password:
 *   CLIENT_EMAIL=client@example.com CLIENT_PASSWORD=pass123 npx tsx scripts/create-test-client.ts
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

const config = {
  email: process.env.CLIENT_EMAIL || "testclient@doogoodscoopers.com",
  password: process.env.CLIENT_PASSWORD || "clientpass123!",
  firstName: "Test",
  lastName: "Client",
  phone: "555-123-4567",
};

async function createTestClient() {
  console.log("Creating test client user...\n");

  // Get the organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .single();

  if (orgError || !org) {
    console.error("No organization found. Run the seed script first:");
    console.error("  npx tsx scripts/seed.ts");
    process.exit(1);
  }

  console.log(`Organization: ${org.name}`);

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === config.email);

  let userId: string;

  if (existingUser) {
    console.log(`User already exists: ${config.email}`);
    userId = existingUser.id;
  } else {
    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
      user_metadata: {
        first_name: config.firstName,
        last_name: config.lastName,
      },
    });

    if (authError) {
      console.error("Failed to create auth user:", authError);
      process.exit(1);
    }

    userId = authUser.user.id;
    console.log(`Auth user created: ${config.email}`);
  }

  // Create/update user profile with CLIENT role
  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      org_id: org.id,
      email: config.email,
      role: "CLIENT",
      first_name: config.firstName,
      last_name: config.lastName,
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Failed to create user profile:", profileError);
    process.exit(1);
  }

  console.log(`User profile created with role: CLIENT`);

  // Check if client record exists
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .single();

  let clientId: string;

  if (existingClient) {
    clientId = existingClient.id;
    console.log(`Client record already exists`);
  } else {
    // Create client record
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        org_id: org.id,
        user_id: userId,
        email: config.email,
        first_name: config.firstName,
        last_name: config.lastName,
        phone: config.phone,
        status: "ACTIVE",
        account_credit_cents: 1000, // $10 credit for testing
      })
      .select()
      .single();

    if (clientError) {
      console.error("Failed to create client:", clientError);
      process.exit(1);
    }

    clientId = newClient.id;
    console.log(`Client record created with $10 account credit`);
  }

  // Check if location exists
  const { data: existingLocation } = await supabase
    .from("locations")
    .select("id")
    .eq("client_id", clientId)
    .single();

  let locationId: string;

  if (existingLocation) {
    locationId = existingLocation.id;
    console.log(`Location already exists`);
  } else {
    // Create a location
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .insert({
        org_id: org.id,
        client_id: clientId,
        address_line1: "123 Test Street",
        city: "Fontana",
        state: "CA",
        zip_code: "92335",
        gate_code: "1234",
        access_notes: "Gate on left side of house",
      })
      .select()
      .single();

    if (locationError) {
      console.error("Failed to create location:", locationError);
      process.exit(1);
    }

    locationId = location.id;
    console.log(`Location created: 123 Test Street, Fontana, CA`);
  }

  // Check if dogs exist
  const { data: existingDogs } = await supabase
    .from("dogs")
    .select("id")
    .eq("client_id", clientId);

  if (!existingDogs || existingDogs.length === 0) {
    // Create dogs
    const { error: dogsError } = await supabase.from("dogs").insert([
      {
        org_id: org.id,
        client_id: clientId,
        name: "Buddy",
        breed: "Golden Retriever",
        is_safe: true,
      },
      {
        org_id: org.id,
        client_id: clientId,
        name: "Max",
        breed: "German Shepherd",
        is_safe: false,
        safety_notes: "Barks at strangers, please knock first",
      },
    ]);

    if (dogsError) {
      console.error("Failed to create dogs:", dogsError);
      process.exit(1);
    }

    console.log(`Dogs created: Buddy (safe), Max (not safe)`);
  } else {
    console.log(`Dogs already exist`);
  }

  // Get or create a service plan
  let { data: plan } = await supabase
    .from("service_plans")
    .select("id")
    .eq("org_id", org.id)
    .single();

  if (!plan) {
    const { data: newPlan, error: planError } = await supabase
      .from("service_plans")
      .insert({
        org_id: org.id,
        name: "Standard Service",
        description: "Weekly pooper scooper service",
        is_active: true,
      })
      .select()
      .single();

    if (planError) {
      console.error("Failed to create service plan:", planError);
    } else {
      plan = newPlan;
      console.log(`Service plan created: Standard Service`);
    }
  }

  // Check if subscription exists
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["ACTIVE", "PAUSED"])
    .single();

  if (!existingSub && plan) {
    // Create subscription
    const nextServiceDate = new Date();
    nextServiceDate.setDate(nextServiceDate.getDate() + 7); // Next week

    const { error: subError } = await supabase.from("subscriptions").insert({
      org_id: org.id,
      client_id: clientId,
      location_id: locationId,
      plan_id: plan.id,
      status: "ACTIVE",
      frequency: "WEEKLY",
      price_per_visit_cents: 3500, // $35/visit
      preferred_day: "Monday",
      next_service_date: nextServiceDate.toISOString().split("T")[0],
    });

    if (subError) {
      console.error("Failed to create subscription:", subError);
    } else {
      console.log(`Subscription created: Weekly @ $35/visit`);
    }
  } else {
    console.log(`Subscription already exists`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("Test Client Login:");
  console.log(`  Email: ${config.email}`);
  console.log(`  Password: ${config.password}`);
  console.log(`  Portal: /app/client`);
  console.log("═══════════════════════════════════════════\n");
}

createTestClient().catch(console.error);
