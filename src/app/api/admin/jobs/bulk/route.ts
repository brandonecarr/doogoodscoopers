/**
 * Bulk Job Operations API
 *
 * Perform bulk operations on jobs (e.g., skip all jobs for weather).
 * Requires jobs:write permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithPermission,
  errorResponse,
} from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * POST /api/admin/jobs/bulk
 *
 * Supported actions:
 * - skip: Skip multiple jobs
 * - reschedule: Reschedule jobs to a new date
 * - assign: Assign jobs to a route or user
 * - unassign: Remove jobs from a route
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "jobs:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    let affectedCount = 0;

    switch (body.action) {
      case "skip": {
        // Skip jobs by IDs or by date
        if (!body.job_ids && !body.date) {
          return NextResponse.json(
            { error: "job_ids or date is required for skip action" },
            { status: 400 }
          );
        }

        const skipReason = body.skip_reason || "Bulk skip";

        if (body.job_ids && Array.isArray(body.job_ids)) {
          // Skip specific jobs
          const { data, error } = await supabase
            .from("jobs")
            .update({
              status: "SKIPPED",
              skip_reason: skipReason,
            })
            .eq("org_id", auth.user.orgId)
            .in("id", body.job_ids)
            .in("status", ["SCHEDULED", "EN_ROUTE"]) // Only skip unstarted jobs
            .select("id");

          if (error) {
            console.error("Error skipping jobs:", error);
            return NextResponse.json(
              { error: "Failed to skip jobs" },
              { status: 500 }
            );
          }

          affectedCount = data?.length || 0;
        } else if (body.date) {
          // Skip all jobs for a specific date
          const { data, error } = await supabase
            .from("jobs")
            .update({
              status: "SKIPPED",
              skip_reason: skipReason,
            })
            .eq("org_id", auth.user.orgId)
            .eq("scheduled_date", body.date)
            .in("status", ["SCHEDULED", "EN_ROUTE"])
            .select("id");

          if (error) {
            console.error("Error skipping jobs:", error);
            return NextResponse.json(
              { error: "Failed to skip jobs" },
              { status: 500 }
            );
          }

          affectedCount = data?.length || 0;
        }

        break;
      }

      case "reschedule": {
        // Reschedule jobs to a new date
        if (!body.job_ids || !body.new_date) {
          return NextResponse.json(
            { error: "job_ids and new_date are required for reschedule action" },
            { status: 400 }
          );
        }

        const { data, error } = await supabase
          .from("jobs")
          .update({
            scheduled_date: body.new_date,
            route_id: null, // Remove from current route
            route_order: null,
          })
          .eq("org_id", auth.user.orgId)
          .in("id", body.job_ids)
          .in("status", ["SCHEDULED", "SKIPPED"]) // Can reschedule scheduled or skipped
          .select("id");

        if (error) {
          console.error("Error rescheduling jobs:", error);
          return NextResponse.json(
            { error: "Failed to reschedule jobs" },
            { status: 500 }
          );
        }

        // Remove from any route stops
        await supabase
          .from("route_stops")
          .delete()
          .in("job_id", body.job_ids);

        // If previously skipped, mark as scheduled
        await supabase
          .from("jobs")
          .update({ status: "SCHEDULED", skip_reason: null })
          .eq("org_id", auth.user.orgId)
          .in("id", body.job_ids)
          .eq("status", "SKIPPED");

        affectedCount = data?.length || 0;
        break;
      }

      case "assign": {
        // Assign jobs to a route
        if (!body.job_ids || !body.route_id) {
          return NextResponse.json(
            { error: "job_ids and route_id are required for assign action" },
            { status: 400 }
          );
        }

        // Verify route belongs to org
        const { data: route } = await supabase
          .from("routes")
          .select("id, route_date")
          .eq("id", body.route_id)
          .eq("org_id", auth.user.orgId)
          .single();

        if (!route) {
          return NextResponse.json(
            { error: "Route not found" },
            { status: 404 }
          );
        }

        // Get current max stop order
        const { data: maxStop } = await supabase
          .from("route_stops")
          .select("stop_order")
          .eq("route_id", body.route_id)
          .order("stop_order", { ascending: false })
          .limit(1)
          .single();

        let nextOrder = (maxStop?.stop_order || 0) + 1;

        // Assign each job
        for (const jobId of body.job_ids) {
          // Verify job date matches route date and belongs to org
          const { data: job } = await supabase
            .from("jobs")
            .select("id, scheduled_date")
            .eq("id", jobId)
            .eq("org_id", auth.user.orgId)
            .single();

          if (!job || job.scheduled_date !== route.route_date) {
            continue;
          }

          // Update job
          await supabase
            .from("jobs")
            .update({
              route_id: body.route_id,
              route_order: nextOrder,
            })
            .eq("id", jobId);

          // Create route stop
          await supabase.from("route_stops").insert({
            org_id: auth.user.orgId,
            route_id: body.route_id,
            job_id: jobId,
            stop_order: nextOrder,
          });

          nextOrder++;
          affectedCount++;
        }

        break;
      }

      case "unassign": {
        // Remove jobs from their routes
        if (!body.job_ids) {
          return NextResponse.json(
            { error: "job_ids is required for unassign action" },
            { status: 400 }
          );
        }

        // Remove from route stops
        await supabase
          .from("route_stops")
          .delete()
          .in("job_id", body.job_ids);

        // Update jobs
        const { data, error } = await supabase
          .from("jobs")
          .update({
            route_id: null,
            route_order: null,
          })
          .eq("org_id", auth.user.orgId)
          .in("id", body.job_ids)
          .select("id");

        if (error) {
          console.error("Error unassigning jobs:", error);
          return NextResponse.json(
            { error: "Failed to unassign jobs" },
            { status: 500 }
          );
        }

        affectedCount = data?.length || 0;
        break;
      }

      case "update_status": {
        // Bulk update job status
        if (!body.job_ids || !body.status) {
          return NextResponse.json(
            { error: "job_ids and status are required for update_status action" },
            { status: 400 }
          );
        }

        const validStatuses = ["SCHEDULED", "SKIPPED", "CANCELED"];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json(
            { error: "Invalid status for bulk update. Allowed: SCHEDULED, SKIPPED, CANCELED" },
            { status: 400 }
          );
        }

        const { data, error } = await supabase
          .from("jobs")
          .update({
            status: body.status,
            skip_reason: body.status === "SKIPPED" ? (body.skip_reason || "Bulk status change") : null,
          })
          .eq("org_id", auth.user.orgId)
          .in("id", body.job_ids)
          .not("status", "eq", "COMPLETED") // Don't change completed jobs
          .select("id");

        if (error) {
          console.error("Error updating job status:", error);
          return NextResponse.json(
            { error: "Failed to update job status" },
            { status: 500 }
          );
        }

        affectedCount = data?.length || 0;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action: body.action,
      affected: affectedCount,
    });
  } catch (error) {
    console.error("Error in bulk job operation:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
