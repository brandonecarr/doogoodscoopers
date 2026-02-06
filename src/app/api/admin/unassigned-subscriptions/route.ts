/**
 * Unassigned Subscriptions API
 *
 * Returns locations that need tech/route assignment.
 * A location is "unassigned" if:
 * 1. It has an active subscription needing initial cleanup (initial_cleanup_required=true AND initial_cleanup_completed=false)
 * 2. OR it has an active subscription with upcoming scheduled jobs without a route assignment
 * 3. OR it has an active subscription with NO jobs at all (newly created)
 * 4. OR it has no active subscription at all (admin-created client with a location)
 *
 * Requires subscriptions:read permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface UnassignedSubscription {
  id: string;
  clientId: string;
  clientName: string;
  locationId: string;
  address: string;
  city: string;
  zipCode: string;
  planName: string | null;
  frequency: string;
  signUpDate: string;
  hasPaymentMethod: boolean;
  needsInitialCleanup: boolean;
  needsRouteAssignment: boolean;
}

/**
 * GET /api/admin/unassigned-subscriptions
 * List subscriptions needing tech/route assignment
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "subscriptions:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;
  const today = new Date().toISOString().split("T")[0];

  try {
    // --- Part 1: Subscriptions-based unassigned locations ---
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        frequency,
        initial_cleanup_required,
        initial_cleanup_completed,
        created_at,
        client:clients!inner (
          id,
          first_name,
          last_name,
          company_name,
          stripe_customer_id
        ),
        location:locations!inner (
          id,
          address_line1,
          city,
          zip_code
        ),
        plan:service_plans (
          id,
          name
        )
      `)
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (subscriptionsError) {
      console.error("Error fetching subscriptions:", subscriptionsError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    // Get ALL jobs for active subscriptions to check assignment status
    const subIds = (subscriptions || []).map((s) => s.id);
    const { data: allJobs, error: jobsError } = subIds.length > 0
      ? await supabase
          .from("jobs")
          .select("subscription_id, route_id, status, scheduled_date")
          .eq("org_id", orgId)
          .in("subscription_id", subIds)
      : { data: [] as { subscription_id: string; route_id: string | null; status: string; scheduled_date: string }[], error: null };

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch job data" },
        { status: 500 }
      );
    }

    // Build maps: which subscriptions have ANY jobs, and which have unassigned scheduled jobs
    const subscriptionsWithJobs = new Set<string>();
    const subscriptionsWithUnassignedJobs = new Set<string>();
    for (const job of allJobs || []) {
      if (job.subscription_id) {
        subscriptionsWithJobs.add(job.subscription_id);
        if (job.status === "SCHEDULED" && job.scheduled_date >= today && !job.route_id) {
          subscriptionsWithUnassignedJobs.add(job.subscription_id);
        }
      }
    }

    // A subscription is unassigned if:
    // 1. Needs initial cleanup
    // 2. Has scheduled jobs without route
    // 3. Has NO jobs at all (brand new subscription)
    const unassignedSubscriptions: UnassignedSubscription[] = (subscriptions || [])
      .filter((sub) => {
        const needsInitialCleanup =
          sub.initial_cleanup_required && !sub.initial_cleanup_completed;
        const needsRouteAssignment = subscriptionsWithUnassignedJobs.has(sub.id);
        const hasNoJobs = !subscriptionsWithJobs.has(sub.id);
        return needsInitialCleanup || needsRouteAssignment || hasNoJobs;
      })
      .map((sub) => {
        const client = sub.client as unknown as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          stripe_customer_id: string | null;
        };
        const location = sub.location as unknown as {
          id: string;
          address_line1: string;
          city: string;
          zip_code: string;
        };
        const plan = sub.plan as unknown as { id: string; name: string } | null;

        let clientName = "";
        if (client.company_name) {
          clientName = client.company_name;
        } else if (client.first_name || client.last_name) {
          clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
        }

        return {
          id: sub.id,
          clientId: client.id,
          clientName,
          locationId: location.id,
          address: location.address_line1,
          city: location.city,
          zipCode: location.zip_code,
          planName: plan?.name || null,
          frequency: sub.frequency,
          signUpDate: sub.created_at,
          hasPaymentMethod: !!client.stripe_customer_id,
          needsInitialCleanup:
            sub.initial_cleanup_required && !sub.initial_cleanup_completed,
          needsRouteAssignment:
            subscriptionsWithUnassignedJobs.has(sub.id) || !subscriptionsWithJobs.has(sub.id),
        };
      });

    // --- Part 2: Locations without any active subscription (admin-created clients) ---
    // Track location IDs that already have active subscriptions
    const locationIdsWithSubscriptions = new Set(
      (subscriptions || []).map((s) => {
        const loc = s.location as unknown as { id: string };
        return loc.id;
      })
    );

    // Find active locations that have NO active subscription
    const { data: allLocations, error: locationsError } = await supabase
      .from("locations")
      .select(`
        id,
        address_line1,
        city,
        zip_code,
        created_at,
        client:clients!inner (
          id,
          first_name,
          last_name,
          company_name,
          stripe_customer_id,
          status
        )
      `)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (locationsError) {
      console.error("Error fetching locations:", locationsError);
      // Non-fatal — we still return subscription-based results
    }

    const orphanedLocations: UnassignedSubscription[] = (allLocations || [])
      .filter((loc) => {
        const client = loc.client as unknown as { status: string };
        return !locationIdsWithSubscriptions.has(loc.id) && client.status === "ACTIVE";
      })
      .map((loc) => {
        const client = loc.client as unknown as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          stripe_customer_id: string | null;
        };

        let clientName = "";
        if (client.company_name) {
          clientName = client.company_name;
        } else if (client.first_name || client.last_name) {
          clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
        }

        return {
          id: `loc-${loc.id}`, // Prefix to distinguish from subscription IDs
          clientId: client.id,
          clientName,
          locationId: loc.id,
          address: loc.address_line1,
          city: loc.city,
          zipCode: loc.zip_code,
          planName: null,
          frequency: "N/A",
          signUpDate: loc.created_at,
          hasPaymentMethod: !!client.stripe_customer_id,
          needsInitialCleanup: true,
          needsRouteAssignment: true,
        };
      });

    const allUnassigned = [...unassignedSubscriptions, ...orphanedLocations];

    return NextResponse.json({
      subscriptions: allUnassigned,
      total: allUnassigned.length,
    });
  } catch (error) {
    console.error("Error in unassigned subscriptions API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
