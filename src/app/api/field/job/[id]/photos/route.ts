/**
 * Field Job Photos API
 *
 * Upload and list photos for a job.
 * Stores photos in Supabase Storage bucket 'job-photos'.
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

// Allowed roles for field operations
const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field/job/[id]/photos
 * List photos for a job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = getSupabase();

  // Verify job exists and belongs to org
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, photos")
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Get photos from job record
  const photos = (job.photos as Array<{
    id: string;
    url: string;
    type: string;
    uploadedAt: string;
    uploadedBy: string;
  }>) || [];

  // Generate signed URLs for each photo
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      // Extract path from URL if it's a storage path
      const path = photo.url.includes("job-photos/")
        ? photo.url.split("job-photos/")[1]
        : `${auth.user!.orgId}/${id}/${photo.id}.jpg`;

      const { data: signedUrl } = await supabase.storage
        .from("job-photos")
        .createSignedUrl(path, 3600); // 1 hour expiry

      return {
        id: photo.id,
        url: signedUrl?.signedUrl || photo.url,
        type: photo.type,
        uploadedAt: photo.uploadedAt,
      };
    })
  );

  return NextResponse.json({ photos: photosWithUrls });
}

/**
 * POST /api/field/job/[id]/photos
 * Upload a photo for a job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const type = formData.get("type") as string || "after"; // before, after, issue

    if (!file) {
      return NextResponse.json(
        { error: "No photo file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }

    // Verify job exists and belongs to org
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, photos, org_id")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Generate unique photo ID
    const photoId = crypto.randomUUID();
    const timestamp = Date.now();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `${photoId}-${timestamp}.${extension}`;
    const storagePath = `${auth.user.orgId}/${id}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Error uploading photo:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload photo" },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("job-photos")
      .getPublicUrl(storagePath);

    // Update job with new photo
    const existingPhotos = (job.photos as Array<{
      id: string;
      url: string;
      type: string;
      uploadedAt: string;
      uploadedBy: string;
    }>) || [];

    const newPhoto = {
      id: photoId,
      url: storagePath,
      type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.user.id,
    };

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        photos: [...existingPhotos, newPhoto],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating job photos:", updateError);
      // Try to clean up the uploaded file
      await supabase.storage.from("job-photos").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to save photo reference" },
        { status: 500 }
      );
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "JOB_PHOTO_UPLOADED",
      entity_type: "JOB",
      entity_id: id,
      details: {
        photoId,
        type,
        fileName,
      },
    });

    return NextResponse.json({
      photo: {
        id: photoId,
        url: urlData.publicUrl,
        type,
        uploadedAt: newPhoto.uploadedAt,
      },
      message: "Photo uploaded successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Error processing photo upload:", error);
    return NextResponse.json(
      { error: "Failed to process photo upload" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/field/job/[id]/photos
 * Delete a photo from a job
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");

    if (!photoId) {
      return NextResponse.json(
        { error: "photoId query parameter is required" },
        { status: 400 }
      );
    }

    // Get job with photos
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, photos")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const existingPhotos = (job.photos as Array<{
      id: string;
      url: string;
      type: string;
      uploadedAt: string;
      uploadedBy: string;
    }>) || [];

    const photoToDelete = existingPhotos.find((p) => p.id === photoId);
    if (!photoToDelete) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Remove from storage
    const storagePath = photoToDelete.url.includes("job-photos/")
      ? photoToDelete.url.split("job-photos/")[1]
      : photoToDelete.url;

    await supabase.storage.from("job-photos").remove([storagePath]);

    // Update job to remove photo reference
    const updatedPhotos = existingPhotos.filter((p) => p.id !== photoId);
    await supabase
      .from("jobs")
      .update({
        photos: updatedPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Log the activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "JOB_PHOTO_DELETED",
      entity_type: "JOB",
      entity_id: id,
      details: {
        photoId,
        type: photoToDelete.type,
      },
    });

    return NextResponse.json({
      message: "Photo deleted successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
