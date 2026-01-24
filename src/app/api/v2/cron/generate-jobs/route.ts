/**
 * Job Generation Cron API
 *
 * Generates scheduled jobs from active subscriptions.
 * Should be called nightly via a cron job (e.g., Vercel Cron).
 *
 * POST /api/v2/cron/generate-jobs
 *
 * Authentication: CRON_SECRET header or authenticated admin
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission } from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Map frequency to service interval in days
const frequencyIntervals: Record<string, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  ONETIME: 0, // One-time jobs are handled differently
};

// Get the day of week as string
function getDayOfWeek(date: Date): string {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return days[date.getDay()];
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Check if a date falls on a service day for the subscription
function isServiceDay(
  date: Date,
  frequency: string,
  subscriptionStartDate: Date,
  preferredDay?: string
): boolean {
  // Skip weekends (service days are Mon-Sat typically)
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return false; // Skip Sunday

  // If preferred day is set, only service on that day
  if (preferredDay) {
    return getDayOfWeek(date) === preferredDay;
  }

  // For weekly, any weekday works
  if (frequency === "WEEKLY") {
    return true;
  }

  // For biweekly, check if this is an "on" week
  if (frequency === "BIWEEKLY") {
    const diffTime = date.getTime() - subscriptionStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7);
    return weekNumber % 2 === 0;
  }

  // For monthly, service on a specific week of the month
  if (frequency === "MONTHLY") {
    const subscriptionDayOfMonth = subscriptionStartDate.getDate();
    const dateDayOfMonth = date.getDate();
    // Service within a week of the subscription start day
    return Math.abs(dateDayOfMonth - subscriptionDayOfMonth) <= 3;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Verify authentication - either CRON_SECRET or authenticated admin
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    // Authenticated via cron secret
  } else {
    // Fall back to admin authentication
    const auth = await authenticateWithPermission(request, "jobs:write");
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const daysAhead = body.daysAhead || 7; // Default to generating 7 days ahead
    const orgId = body.orgId; // Optional: limit to specific org

    const supabase = getSupabase();

    // Build subscription query
    let subscriptionQuery = supabase
      .from("subscriptions")
      .select(`
        id,
        org_id,
        client_id,
        location_id,
        plan_id,
        frequency,
        preferred_day,
        price_per_visit_cents,
        next_service_date,
        created_at,
        client:client_id (
          id,
          first_name,
          last_name,
          status
        ),
        location:location_id (
          id,
          address_line1,
          city,
          zip_code,
          is_active
        )
      `)
      .eq("status", "ACTIVE")
      .neq("frequency", "ONETIME"); // Exclude one-time (handled separately)

    if (orgId) {
      subscriptionQuery = subscriptionQuery.eq("org_id", orgId);
    }

    const { data: subscriptions, error: subError } = await subscriptionQuery;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active subscriptions found",
        generated: 0,
        skipped: 0,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each subscription
    for (const subscription of subscriptions) {
      // Skip if client or location is inactive
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientData = subscription.client as any;
      const client = clientData ? { id: clientData.id, status: clientData.status } : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationData = subscription.location as any;
      const location = locationData ? { id: locationData.id, is_active: locationData.is_active } : null;

      if (!client || client.status !== "ACTIVE") {
        totalSkipped++;
        continue;
      }

      if (!location || !location.is_active) {
        totalSkipped++;
        continue;
      }

      const subscriptionStart = new Date(subscription.created_at);
      const intervalDays = frequencyIntervals[subscription.frequency] || 7;

      // Generate jobs for each day in the range
      for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
        const jobDate = addDays(today, dayOffset);
        const jobDateStr = jobDate.toISOString().split("T")[0];

        // Check if this is a service day for this subscription
        if (!isServiceDay(
          jobDate,
          subscription.frequency,
          subscriptionStart,
          subscription.preferred_day
        )) {
          continue;
        }

        // Check if a job already exists for this subscription on this date
        const { data: existingJob } = await supabase
          .from("jobs")
          .select("id")
          .eq("subscription_id", subscription.id)
          .eq("scheduled_date", jobDateStr)
          .single();

        if (existingJob) {
          // Job already exists, skip
          continue;
        }

        // Create the job
        const { error: jobError } = await supabase.from("jobs").insert({
          org_id: subscription.org_id,
          subscription_id: subscription.id,
          client_id: subscription.client_id,
          location_id: subscription.location_id,
          scheduled_date: jobDateStr,
          status: "SCHEDULED",
          price_cents: subscription.price_per_visit_cents,
          metadata: {
            generated_by: "cron",
            generated_at: new Date().toISOString(),
            frequency: subscription.frequency,
          },
        });

        if (jobError) {
          console.error(`Error creating job for subscription ${subscription.id}:`, jobError);
          totalErrors++;
        } else {
          totalGenerated++;
        }
      }
    }

    // Also handle one-time subscriptions that need their single job created
    const { data: onetimeSubscriptions } = await supabase
      .from("subscriptions")
      .select(`
        id,
        org_id,
        client_id,
        location_id,
        plan_id,
        price_per_visit_cents,
        next_service_date,
        created_at
      `)
      .eq("status", "ACTIVE")
      .eq("frequency", "ONETIME")
      .not("next_service_date", "is", null);

    if (onetimeSubscriptions) {
      for (const subscription of onetimeSubscriptions) {
        // Check if job already exists
        const { data: existingJob } = await supabase
          .from("jobs")
          .select("id")
          .eq("subscription_id", subscription.id)
          .single();

        if (existingJob) {
          continue;
        }

        // Create the one-time job
        const { error: jobError } = await supabase.from("jobs").insert({
          org_id: subscription.org_id,
          subscription_id: subscription.id,
          client_id: subscription.client_id,
          location_id: subscription.location_id,
          scheduled_date: subscription.next_service_date,
          status: "SCHEDULED",
          price_cents: subscription.price_per_visit_cents,
          metadata: {
            generated_by: "cron",
            generated_at: new Date().toISOString(),
            frequency: "ONETIME",
          },
        });

        if (jobError) {
          console.error(`Error creating one-time job for subscription ${subscription.id}:`, jobError);
          totalErrors++;
        } else {
          totalGenerated++;
        }
      }
    }

    console.log(`Job generation complete: ${totalGenerated} created, ${totalSkipped} skipped, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      message: "Job generation completed",
      generated: totalGenerated,
      skipped: totalSkipped,
      errors: totalErrors,
      subscriptionsProcessed: subscriptions.length,
      daysAhead,
    });
  } catch (error) {
    console.error("Error in job generation:", error);
    return NextResponse.json(
      { error: "Job generation failed" },
      { status: 500 }
    );
  }
}

// GET endpoint for manual triggering with query params
export async function GET(request: NextRequest) {
  // Convert to POST with body from query params
  const { searchParams } = new URL(request.url);
  const daysAhead = searchParams.get("daysAhead");
  const orgId = searchParams.get("orgId");

  // Create a new request with the body
  const body = JSON.stringify({
    daysAhead: daysAhead ? parseInt(daysAhead) : undefined,
    orgId: orgId || undefined,
  });

  const newRequest = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body,
  });

  return POST(newRequest);
}
