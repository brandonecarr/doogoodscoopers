/**
 * Client Schedule API
 *
 * Returns upcoming and past service jobs for the authenticated client.
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
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "upcoming"; // upcoming | past
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("jobs")
      .select(`
        id,
        scheduled_date,
        status,
        started_at,
        completed_at,
        skip_reason,
        photos,
        location:location_id (
          id,
          address_line1,
          city,
          state,
          zip_code
        ),
        assigned_user:assigned_to (
          first_name,
          last_name
        )
      `, { count: "exact" })
      .eq("client_id", client.id);

    if (view === "upcoming") {
      query = query
        .gte("scheduled_date", today)
        .in("status", ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS"])
        .order("scheduled_date", { ascending: true });
    } else {
      query = query
        .in("status", ["COMPLETED", "SKIPPED", "CANCELED"])
        .order("completed_at", { ascending: false });
    }

    const { data: jobs, count, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching schedule:", error);
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
    }

    // Format jobs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedJobs = (jobs || []).map((job: any) => ({
      id: job.id,
      scheduledDate: job.scheduled_date,
      status: job.status,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      skipReason: job.skip_reason,
      photoCount: Array.isArray(job.photos) ? job.photos.length : 0,
      location: job.location
        ? {
            id: job.location.id,
            addressLine1: job.location.address_line1,
            city: job.location.city,
            state: job.location.state,
            zipCode: job.location.zip_code,
          }
        : null,
      technician: job.assigned_user
        ? {
            firstName: job.assigned_user.first_name,
            lastName: job.assigned_user.last_name,
          }
        : null,
    }));

    return NextResponse.json({
      jobs: formattedJobs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
