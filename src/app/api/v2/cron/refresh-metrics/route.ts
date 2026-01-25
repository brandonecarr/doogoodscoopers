/**
 * Cron Job: Refresh Public Metrics
 *
 * Nightly job to compute and cache public metrics for the PetYard Tracker.
 * Should be called via Vercel Cron or similar.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, created_at");

    if (orgsError) {
      console.error("Error fetching organizations:", orgsError);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    const results: Array<{ orgId: string; success: boolean; error?: string }> = [];

    for (const org of orgs || []) {
      try {
        const metrics = await computeMetrics(supabase, org.id, org.created_at);

        // Upsert the cached metrics
        const { error: upsertError } = await supabase
          .from("public_metrics_cache")
          .upsert(
            {
              org_id: org.id,
              metrics,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "org_id" }
          );

        if (upsertError) {
          results.push({ orgId: org.id, success: false, error: upsertError.message });
        } else {
          results.push({ orgId: org.id, success: true });
        }
      } catch (err) {
        results.push({
          orgId: org.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Refreshed metrics for ${successCount} organizations`,
      processed: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("Error in refresh-metrics cron:", error);
    return NextResponse.json(
      { error: "An error occurred during metrics refresh" },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeMetrics(
  supabase: any,
  orgId: string,
  createdAt: string
) {
  // Count clients (satisfied customers) - include all statuses
  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Count dogs (happy pets)
  const { count: dogCount } = await supabase
    .from("dogs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Count completed jobs (completed yards)
  const { count: jobCount } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "COMPLETED");

  // Calculate years in business
  const foundingDate = createdAt ? new Date(createdAt) : new Date("2020-01-01");
  const yearsInBusiness = Math.max(
    1,
    Math.floor((Date.now() - foundingDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  );

  return {
    satisfiedCustomers: clientCount || 0,
    happyPets: dogCount || 0,
    completedYards: jobCount || 0,
    yearsInBusiness,
    lastUpdated: new Date().toISOString(),
  };
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
