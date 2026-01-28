/**
 * Unassigned Subscriptions API
 *
 * Returns subscriptions that need tech/route assignment.
 * A subscription is "unassigned" if:
 * 1. It needs initial cleanup (initial_cleanup_required=true AND initial_cleanup_completed=false)
 * 2. OR it has upcoming scheduled jobs without a route assignment
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
    // Get all active subscriptions
    // Note: subscriptions table doesn't have assigned_to column
    // We determine "unassigned" based on jobs without routes or pending initial cleanup
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

    // Get jobs without route assignment for these subscriptions
    const { data: unassignedJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("subscription_id")
      .eq("org_id", orgId)
      .eq("status", "SCHEDULED")
      .gte("scheduled_date", today)
      .is("route_id", null)
      .not("subscription_id", "is", null);

    if (jobsError) {
      console.error("Error fetching unassigned jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch job data" },
        { status: 500 }
      );
    }

    // Build set of subscription IDs with unassigned jobs
    const subscriptionsWithUnassignedJobs = new Set(
      (unassignedJobs || []).map((j) => j.subscription_id)
    );

    // Filter to only unassigned subscriptions and transform
    const unassignedSubscriptions: UnassignedSubscription[] = (subscriptions || [])
      .filter((sub) => {
        const needsInitialCleanup =
          sub.initial_cleanup_required && !sub.initial_cleanup_completed;
        const needsRouteAssignment = subscriptionsWithUnassignedJobs.has(sub.id);
        return needsInitialCleanup || needsRouteAssignment;
      })
      .map((sub) => {
        // Supabase returns the relation as a single object when using !inner
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

        // Build client name
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
          needsRouteAssignment: subscriptionsWithUnassignedJobs.has(sub.id),
        };
      });

    return NextResponse.json({
      subscriptions: unassignedSubscriptions,
      total: unassignedSubscriptions.length,
    });
  } catch (error) {
    console.error("Error in unassigned subscriptions API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
