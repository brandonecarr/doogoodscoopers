/**
 * Subscription Job Management
 *
 * Shared utilities for voiding and regenerating jobs when subscriptions change.
 * Used by both admin subscriptions API and Stripe webhooks.
 */

import { SupabaseClient } from "@supabase/supabase-js";

interface Subscription {
  id: string;
  client_id: string;
  location_id: string;
  frequency: string;
  preferred_day?: string | null;
  price_per_visit_cents: number;
  created_at: string;
  status: string;
}

/**
 * Void all future scheduled/en_route jobs for a subscription
 * Returns the count of jobs voided
 */
export async function voidFutureJobsForSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  orgId: string,
  reason: string = "Subscription changed"
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  // Cancel future jobs
  const { data: voidedJobs, error: voidError } = await supabase
    .from("jobs")
    .update({
      status: "CANCELED",
      skip_reason: reason
    })
    .eq("subscription_id", subscriptionId)
    .eq("org_id", orgId)
    .gte("scheduled_date", today)
    .in("status", ["SCHEDULED", "EN_ROUTE"])
    .select("id");

  if (voidError) {
    console.error("Error voiding jobs:", voidError);
    return 0;
  }

  const voidedCount = voidedJobs?.length || 0;

  // Remove voided jobs from routes
  if (voidedJobs && voidedJobs.length > 0) {
    const jobIds = voidedJobs.map((j) => j.id);

    await supabase
      .from("route_stops")
      .delete()
      .in("job_id", jobIds);

    await supabase
      .from("jobs")
      .update({ route_id: null, route_order: null })
      .in("id", jobIds);
  }

  return voidedCount;
}

/**
 * Regenerate jobs for a subscription based on its frequency
 * Returns the count of jobs generated
 */
export async function regenerateJobsForSubscription(
  supabase: SupabaseClient,
  subscription: Subscription,
  orgId: string,
  daysAhead: number = 14
): Promise<number> {
  // Don't generate jobs for non-active subscriptions
  if (subscription.status !== "ACTIVE") {
    return 0;
  }

  // Don't generate for one-time subscriptions
  if (subscription.frequency === "ONETIME") {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDayOfWeek = (date: Date): string => {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    return days[date.getDay()];
  };

  const isServiceDay = (
    date: Date,
    frequency: string,
    subscriptionStartDate: Date,
    preferredDay?: string | null
  ): boolean => {
    const dayOfWeek = date.getDay();
    // Skip Sunday
    if (dayOfWeek === 0) return false;

    // If preferred day is set, only that day is a service day
    if (preferredDay) {
      return getDayOfWeek(date) === preferredDay;
    }

    // Weekly - any weekday (Mon-Sat)
    if (frequency === "WEEKLY") {
      return true;
    }

    // Biweekly - every other week from subscription start
    if (frequency === "BIWEEKLY") {
      const diffTime = date.getTime() - subscriptionStartDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(diffDays / 7);
      return weekNumber % 2 === 0;
    }

    // Monthly - within 3 days of subscription day of month
    if (frequency === "MONTHLY") {
      const subscriptionDayOfMonth = subscriptionStartDate.getDate();
      const dateDayOfMonth = date.getDate();
      return Math.abs(dateDayOfMonth - subscriptionDayOfMonth) <= 3;
    }

    return false;
  };

  let generatedCount = 0;
  const subscriptionStart = new Date(subscription.created_at);

  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
    const jobDate = new Date(today);
    jobDate.setDate(jobDate.getDate() + dayOffset);
    const jobDateStr = jobDate.toISOString().split("T")[0];

    if (!isServiceDay(
      jobDate,
      subscription.frequency,
      subscriptionStart,
      subscription.preferred_day
    )) {
      continue;
    }

    // Check if job already exists for this date
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("id")
      .eq("subscription_id", subscription.id)
      .eq("scheduled_date", jobDateStr)
      .neq("status", "CANCELED")
      .single();

    if (existingJob) {
      continue;
    }

    // Create the job
    const { error: jobError } = await supabase.from("jobs").insert({
      org_id: orgId,
      subscription_id: subscription.id,
      client_id: subscription.client_id,
      location_id: subscription.location_id,
      scheduled_date: jobDateStr,
      status: "SCHEDULED",
      price_cents: subscription.price_per_visit_cents,
      metadata: {
        generated_by: "subscription_change",
        generated_at: new Date().toISOString(),
        frequency: subscription.frequency,
      },
    });

    if (!jobError) {
      generatedCount++;
    }
  }

  return generatedCount;
}

/**
 * Handle a subscription status change - void or regenerate jobs as needed
 */
export async function handleSubscriptionStatusChange(
  supabase: SupabaseClient,
  subscriptionId: string,
  orgId: string,
  oldStatus: string,
  newStatus: string
): Promise<{ voided: number; generated: number }> {
  const result = { voided: 0, generated: 0 };

  // If status is being set to PAUSED or CANCELED, void future jobs
  if (newStatus === "PAUSED" || newStatus === "CANCELED") {
    const reason = newStatus === "PAUSED" ? "Subscription paused" : "Subscription canceled";
    result.voided = await voidFutureJobsForSubscription(
      supabase,
      subscriptionId,
      orgId,
      reason
    );
    return result;
  }

  // If status is being set to ACTIVE from another status, regenerate jobs
  if (newStatus === "ACTIVE" && oldStatus !== "ACTIVE") {
    // Fetch the subscription to get required fields
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, client_id, location_id, frequency, preferred_day, price_per_visit_cents, created_at, status")
      .eq("id", subscriptionId)
      .single();

    if (subscription) {
      result.generated = await regenerateJobsForSubscription(
        supabase,
        subscription as Subscription,
        orgId
      );
    }
  }

  return result;
}
