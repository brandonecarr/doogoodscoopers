/**
 * Route Optimization API
 *
 * Optimizes route stops by grouping jobs by ZIP code.
 * This is a basic optimization that clusters nearby stops together.
 * Requires routes:write permission.
 *
 * POST /api/admin/routes/optimize
 * Body: { routeId: string } - Optimize an existing route
 *   OR
 * Body: { date: string, jobIds: string[] } - Create optimized route from jobs
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

interface JobWithLocation {
  id: string;
  client_id: string;
  location: {
    id: string;
    zip_code: string;
    city: string;
    address_line1: string;
    lat?: number;
    lng?: number;
  };
}

/**
 * Sort jobs by ZIP code to minimize travel
 * Groups by ZIP, then sorts within each ZIP group
 */
function optimizeJobsByZip(jobs: JobWithLocation[]): JobWithLocation[] {
  // Group jobs by ZIP code
  const zipGroups: Map<string, JobWithLocation[]> = new Map();

  for (const job of jobs) {
    const zip = job.location?.zip_code || "00000";
    if (!zipGroups.has(zip)) {
      zipGroups.set(zip, []);
    }
    zipGroups.get(zip)!.push(job);
  }

  // Sort ZIP codes numerically
  const sortedZips = Array.from(zipGroups.keys()).sort((a, b) => {
    // Extract the base ZIP (first 5 digits)
    const zipA = parseInt(a.slice(0, 5)) || 0;
    const zipB = parseInt(b.slice(0, 5)) || 0;
    return zipA - zipB;
  });

  // Flatten back into a single array, maintaining ZIP grouping
  const optimizedJobs: JobWithLocation[] = [];
  for (const zip of sortedZips) {
    const jobsInZip = zipGroups.get(zip)!;

    // Within each ZIP, sort by street address for a basic street-by-street approach
    jobsInZip.sort((a, b) => {
      const addrA = a.location?.address_line1 || "";
      const addrB = b.location?.address_line1 || "";
      return addrA.localeCompare(addrB);
    });

    optimizedJobs.push(...jobsInZip);
  }

  return optimizedJobs;
}

/**
 * POST /api/admin/routes/optimize
 * Optimize route stop order by ZIP code
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { orgId } = auth.user;

  try {
    const body = await request.json();
    const supabase = getSupabase();

    // Option 1: Optimize an existing route
    if (body.routeId) {
      const routeId = body.routeId;

      // Verify route belongs to org
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .select("id, status, route_date")
        .eq("id", routeId)
        .eq("org_id", orgId)
        .single();

      if (routeError || !route) {
        return NextResponse.json(
          { error: "Route not found" },
          { status: 404 }
        );
      }

      if (route.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Cannot optimize a completed route" },
          { status: 400 }
        );
      }

      // Get all stops with job and location info
      const { data: stops, error: stopsError } = await supabase
        .from("route_stops")
        .select(`
          id,
          job:job_id (
            id,
            client_id,
            location:location_id (
              id,
              zip_code,
              city,
              address_line1,
              lat,
              lng
            )
          )
        `)
        .eq("route_id", routeId);

      if (stopsError) {
        console.error("Error fetching route stops:", stopsError);
        return NextResponse.json(
          { error: "Failed to fetch route stops" },
          { status: 500 }
        );
      }

      if (!stops || stops.length === 0) {
        return NextResponse.json({
          message: "No stops to optimize",
          stops: [],
        });
      }

      // Extract jobs from stops
      const jobs: JobWithLocation[] = stops
        .filter((s) => s.job)
        .map((s) => {
          const job = s.job as unknown as JobWithLocation;
          return {
            id: job.id,
            client_id: job.client_id,
            location: job.location,
          };
        });

      // Optimize order
      const optimizedJobs = optimizeJobsByZip(jobs);

      // Create a map of job ID to new order
      const newOrder = new Map<string, number>();
      optimizedJobs.forEach((job, index) => {
        newOrder.set(job.id, index + 1);
      });

      // Update stop orders
      for (const stop of stops) {
        const job = stop.job as unknown as { id: string } | null;
        if (job) {
          const order = newOrder.get(job.id);
          if (order !== undefined) {
            await supabase
              .from("route_stops")
              .update({ stop_order: order })
              .eq("id", stop.id);

            // Also update job route_order
            await supabase
              .from("jobs")
              .update({ route_order: order })
              .eq("id", job.id);
          }
        }
      }

      // Return the optimized stop order
      const { data: updatedStops } = await supabase
        .from("route_stops")
        .select(`
          id,
          stop_order,
          job:job_id (
            id,
            status,
            client:client_id (
              id,
              first_name,
              last_name
            ),
            location:location_id (
              id,
              zip_code,
              city,
              address_line1
            )
          )
        `)
        .eq("route_id", routeId)
        .order("stop_order");

      return NextResponse.json({
        message: `Optimized ${stops.length} stops by ZIP code`,
        stops: updatedStops,
      });
    }

    // Option 2: Create an optimized route from a list of job IDs
    if (body.date && body.jobIds && Array.isArray(body.jobIds)) {
      const { date, jobIds, name, assignedTo } = body;

      if (jobIds.length === 0) {
        return NextResponse.json(
          { error: "At least one job ID is required" },
          { status: 400 }
        );
      }

      // Get jobs with locations
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          id,
          client_id,
          location:location_id (
            id,
            zip_code,
            city,
            address_line1,
            lat,
            lng
          )
        `)
        .eq("org_id", orgId)
        .in("id", jobIds);

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError);
        return NextResponse.json(
          { error: "Failed to fetch jobs" },
          { status: 500 }
        );
      }

      if (!jobs || jobs.length === 0) {
        return NextResponse.json(
          { error: "No valid jobs found" },
          { status: 404 }
        );
      }

      // Cast to proper type
      const typedJobs: JobWithLocation[] = jobs.map((j) => ({
        id: j.id,
        client_id: j.client_id,
        location: j.location as unknown as JobWithLocation["location"],
      }));

      // Optimize order
      const optimizedJobs = optimizeJobsByZip(typedJobs);

      // Create the route
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          org_id: orgId,
          route_date: date,
          name: name || `Optimized Route - ${date}`,
          assigned_to: assignedTo || null,
          status: "PLANNED",
        })
        .select()
        .single();

      if (routeError) {
        console.error("Error creating route:", routeError);
        return NextResponse.json(
          { error: "Failed to create route" },
          { status: 500 }
        );
      }

      // Create route stops with optimized order
      const stopsToInsert = optimizedJobs.map((job, index) => ({
        org_id: orgId,
        route_id: route.id,
        job_id: job.id,
        stop_order: index + 1,
      }));

      const { error: stopsError } = await supabase
        .from("route_stops")
        .insert(stopsToInsert);

      if (stopsError) {
        console.error("Error creating route stops:", stopsError);
        // Clean up the route
        await supabase.from("routes").delete().eq("id", route.id);
        return NextResponse.json(
          { error: "Failed to create route stops" },
          { status: 500 }
        );
      }

      // Update jobs with route assignment
      for (let i = 0; i < optimizedJobs.length; i++) {
        await supabase
          .from("jobs")
          .update({ route_id: route.id, route_order: i + 1 })
          .eq("id", optimizedJobs[i].id);
      }

      // Get the full route with stops
      const { data: fullRoute } = await supabase
        .from("routes")
        .select(`
          *,
          assigned_user:assigned_to (
            id,
            first_name,
            last_name,
            email
          ),
          stops:route_stops (
            id,
            stop_order,
            job:job_id (
              id,
              status,
              client:client_id (
                id,
                first_name,
                last_name
              ),
              location:location_id (
                id,
                zip_code,
                city,
                address_line1
              )
            )
          )
        `)
        .eq("id", route.id)
        .single();

      // Sort stops
      if (fullRoute?.stops) {
        fullRoute.stops.sort(
          (a: { stop_order: number }, b: { stop_order: number }) =>
            a.stop_order - b.stop_order
        );
      }

      return NextResponse.json({
        message: `Created optimized route with ${optimizedJobs.length} stops`,
        route: fullRoute,
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Either routeId or (date + jobIds) is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error optimizing route:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/admin/routes/optimize/preview
 * Preview the optimized order for a set of jobs without creating/modifying anything
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { orgId } = auth.user;
  const { searchParams } = new URL(request.url);
  const jobIds = searchParams.get("jobIds");

  if (!jobIds) {
    return NextResponse.json(
      { error: "jobIds query parameter is required" },
      { status: 400 }
    );
  }

  const jobIdArray = jobIds.split(",").filter((id) => id.trim());
  if (jobIdArray.length === 0) {
    return NextResponse.json(
      { error: "At least one job ID is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Get jobs with locations
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(`
      id,
      client_id,
      client:client_id (
        first_name,
        last_name
      ),
      location:location_id (
        id,
        zip_code,
        city,
        address_line1,
        lat,
        lng
      )
    `)
    .eq("org_id", orgId)
    .in("id", jobIdArray);

  if (jobsError) {
    console.error("Error fetching jobs:", jobsError);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      message: "No valid jobs found",
      preview: [],
    });
  }

  // Cast and optimize
  const typedJobs: JobWithLocation[] = jobs.map((j) => ({
    id: j.id,
    client_id: j.client_id,
    location: j.location as unknown as JobWithLocation["location"],
  }));

  const optimizedJobs = optimizeJobsByZip(typedJobs);

  // Build preview with original job data
  const preview = optimizedJobs.map((optimizedJob, index) => {
    const originalJob = jobs.find((j) => j.id === optimizedJob.id);
    return {
      order: index + 1,
      jobId: optimizedJob.id,
      client: originalJob?.client || null,
      location: optimizedJob.location,
    };
  });

  return NextResponse.json({
    message: `Preview of ${preview.length} stops optimized by ZIP code`,
    preview,
  });
}
