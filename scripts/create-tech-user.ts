/**
 * Create a Field Tech User
 *
 * Usage:
 *   npx tsx scripts/create-tech-user.ts
 *
 * Or with custom email/password:
 *   TECH_EMAIL=mytech@example.com TECH_PASSWORD=mypass123 npx tsx scripts/create-tech-user.ts
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
  email: process.env.TECH_EMAIL || "tech@doogoodscoopers.com",
  password: process.env.TECH_PASSWORD || "techpass123!",
  firstName: "Test",
  lastName: "Technician",
  role: "FIELD_TECH" as const,
};

async function createTechUser() {
  console.log("Creating field tech user...\n");

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

  // Create/update user profile
  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      org_id: org.id,
      email: config.email,
      role: config.role,
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

  console.log(`User profile created with role: ${config.role}`);

  console.log("\n═══════════════════════════════════════════");
  console.log("Field Tech Login:");
  console.log(`  Email: ${config.email}`);
  console.log(`  Password: ${config.password}`);
  console.log(`  Portal: /app/field`);
  console.log("═══════════════════════════════════════════\n");
}

createTechUser().catch(console.error);
