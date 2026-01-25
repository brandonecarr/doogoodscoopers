/**
 * Client Job Photos API
 *
 * Fetch photos for a job that belongs to the authenticated client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/client/schedule/[jobId]/photos
 * Get photos for a job belonging to the authenticated client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  // Only clients can access this endpoint
  if (auth.user.role !== "CLIENT") {
    return NextResponse.json(
      { error: "Only clients can access this endpoint" },
      { status: 403 }
    );
  }

  const { jobId } = await params;
  const supabase = getSupabase();

  try {
    // Get the client record to find their subscription
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Get the job and verify it belongs to the client
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        scheduled_date,
        status,
        photos,
        subscription:subscriptions!inner (
          id,
          client_id,
          location:locations (
            address_line1,
            city
          )
        ),
        technician:users!jobs_technician_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Verify the job belongs to this client's subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscriptionData = job.subscription as any;
    const subscription = Array.isArray(subscriptionData) ? subscriptionData[0] : subscriptionData;

    if (!subscription || subscription.client_id !== client.id) {
      return NextResponse.json(
        { error: "Not authorized to view this job" },
        { status: 403 }
      );
    }

    // Get photos from job record
    const photos = (job.photos as Array<{
      id: string;
      url: string;
      type: string;
      uploadedAt: string;
    }>) || [];

    // Generate signed URLs for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        // Extract path from URL if it's a storage path
        const path = photo.url.includes("job-photos/")
          ? photo.url.split("job-photos/")[1]
          : photo.url;

        const { data: signedUrl } = await supabase.storage
          .from("job-photos")
          .createSignedUrl(path, 3600); // 1 hour expiry

        return {
          id: photo.id,
          url: signedUrl?.signedUrl || photo.url,
          type: photo.type,
          takenAt: photo.uploadedAt,
        };
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tech = job.technician as any;
    const location = subscription?.location;
    const loc = Array.isArray(location) ? location[0] : location;

    return NextResponse.json({
      job: {
        id: job.id,
        scheduledDate: job.scheduled_date,
        status: job.status,
        location: loc ? {
          addressLine1: loc.address_line1,
          city: loc.city,
        } : null,
        technician: tech ? {
          firstName: tech.first_name,
          lastName: tech.last_name,
        } : null,
      },
      photos: photosWithUrls,
    });
  } catch (error) {
    console.error("Error fetching job photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
