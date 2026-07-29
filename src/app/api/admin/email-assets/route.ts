/**
 * Email image assets.
 *
 * Uploads go to the public Supabase Storage bucket `email-assets` and come
 * back as permanent public URLs. Emails can't carry signed URLs (they expire
 * long before someone opens the message) and base64 images get stripped or
 * blow past size limits, so a plain public URL is the only thing that works.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const BUCKET = "email-assets";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

type Supabase = NonNullable<ReturnType<typeof getSupabase>>;

/** Create the bucket on first use so this needs no manual dashboard setup. */
async function ensureBucket(supabase: Supabase) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ assets: [] });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return NextResponse.json({ assets: [] });

  const assets = data
    .filter((f) => f.id)
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }));
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Image storage is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image is too large — 5MB maximum." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP or GIF image." }, { status: 400 });
    }

    await ensureBucket(supabase);

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const safeName = (file.name || "image")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .slice(0, 40)
      .toLowerCase();
    const path = `${Date.now()}-${safeName || "image"}.${ext}`;

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
    });
    if (error) {
      console.error("Email asset upload failed:", error);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error("Email asset upload error:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
