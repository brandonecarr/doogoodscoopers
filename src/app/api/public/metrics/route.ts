/**
 * Public Metrics API (PetYard Tracker)
 *
 * Returns publicly displayable metrics for the organization.
 * These metrics are cached nightly and displayed on the website.
 *
 * GET: Retrieve public metrics
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

// Default org ID for single-tenant setup
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || "doogoodscoopers";

interface PublicMetrics {
  satisfiedCustomers: number;
  happyPets: number;
  completedYards: number;
  yearsInBusiness: number;
  lastUpdated: string;
}

/**
 * GET /api/public/metrics
 * Returns publicly displayable metrics
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  // Get org ID from query param or use default
  const searchParams = request.nextUrl.searchParams;
  const orgSlug = searchParams.get("org") || DEFAULT_ORG_ID;

  try {
    // Try to get cached metrics first
    const { data: cached } = await supabase
      .from("public_metrics_cache")
      .select("*")
      .eq("org_id", orgSlug)
      .single();

    if (cached && cached.metrics) {
      // Check if cache is fresh (less than 24 hours old)
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge < maxAge) {
        return NextResponse.json({
          ...cached.metrics,
          cached: true,
          lastUpdated: cached.updated_at,
        });
      }
    }

    // If no cache or stale, compute fresh metrics
    const metrics = await computeMetrics(supabase, orgSlug);

    // Update cache
    if (cached) {
      await supabase
        .from("public_metrics_cache")
        .update({
          metrics,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgSlug);
    } else {
      await supabase.from("public_metrics_cache").insert({
        org_id: orgSlug,
        metrics,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ...metrics,
      cached: false,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching public metrics:", error);

    // Return fallback metrics if there's an error
    return NextResponse.json({
      satisfiedCustomers: 500,
      happyPets: 1200,
      completedYards: 25000,
      yearsInBusiness: 5,
      cached: false,
      lastUpdated: new Date().toISOString(),
      error: "Using fallback metrics",
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeMetrics(
  supabase: any,
  orgId: string
): Promise<PublicMetrics> {
  // Get organization to find founding date
  const { data: org } = await supabase
    .from("organizations")
    .select("id, created_at")
    .eq("id", orgId)
    .single();

  const actualOrgId = org?.id || orgId;

  // Count active + past clients (satisfied customers)
  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", actualOrgId);

  // Count dogs (happy pets)
  const { count: dogCount } = await supabase
    .from("dogs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", actualOrgId);

  // Count completed jobs (completed yards)
  const { count: jobCount } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", actualOrgId)
    .eq("status", "COMPLETED");

  // Calculate years in business
  const foundingDate = org?.created_at ? new Date(org.created_at) : new Date("2020-01-01");
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

// CORS headers for widget embedding
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
