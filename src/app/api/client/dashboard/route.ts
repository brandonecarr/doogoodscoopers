/**
 * Client Dashboard API
 *
 * Returns dashboard data for the authenticated client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        account_credit_cents,
        referral_code
      `)
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get next upcoming job
    const today = new Date().toISOString().split("T")[0];
    const { data: nextJob } = await supabase
      .from("jobs")
      .select(`
        id,
        scheduled_date,
        status,
        location:location_id (
          address_line1,
          city
        )
      `)
      .eq("client_id", client.id)
      .gte("scheduled_date", today)
      .in("status", ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS"])
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .single();

    // Get subscription info
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(`
        id,
        status,
        frequency,
        price_per_visit_cents,
        next_service_date,
        plan:plan_id (
          name
        )
      `)
      .eq("client_id", client.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .single();

    // Get referral stats
    const { data: referrals } = await supabase
      .from("referrals")
      .select("id, status")
      .eq("referrer_client_id", client.id);

    const referralStats = {
      total: referrals?.length || 0,
      converted: referrals?.filter((r) => r.status === "CONVERTED").length || 0,
      pending: referrals?.filter((r) => r.status === "PENDING").length || 0,
    };

    // Get account balance (invoices - payments)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total_cents, paid_cents")
      .eq("client_id", client.id)
      .eq("status", "UNPAID");

    const openBalance = invoices?.reduce(
      (sum, inv) => sum + (inv.total_cents - (inv.paid_cents || 0)),
      0
    ) || 0;

    // Get recent completed jobs count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: recentJobsCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "COMPLETED")
      .gte("completed_at", thirtyDaysAgo.toISOString());

    return NextResponse.json({
      client: {
        id: client.id,
        firstName: client.first_name,
        lastName: client.last_name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        referralCode: client.referral_code,
      },
      nextService: nextJob
        ? {
            id: nextJob.id,
            date: nextJob.scheduled_date,
            status: nextJob.status,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            address: (nextJob.location as any)?.address_line1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            city: (nextJob.location as any)?.city,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            frequency: subscription.frequency,
            pricePerVisit: subscription.price_per_visit_cents,
            nextServiceDate: subscription.next_service_date,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            planName: (subscription.plan as any)?.name,
          }
        : null,
      balance: {
        accountCredit: client.account_credit_cents || 0,
        openBalance,
      },
      referrals: referralStats,
      stats: {
        recentJobsCount: recentJobsCount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}
