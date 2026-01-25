/**
 * Client Dogs API
 *
 * Manage client dog information.
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

/**
 * GET /api/client/dogs
 * Get all dogs for the authenticated client
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", auth.user.id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: dogs, error } = await supabase
    .from("dogs")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch dogs" }, { status: 500 });
  }

  return NextResponse.json({
    dogs: dogs.map((dog) => ({
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      isSafe: dog.is_safe,
      safetyNotes: dog.safety_notes,
    })),
  });
}

/**
 * PUT /api/client/dogs
 * Update a dog's information
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { dogId, name, breed, isSafe, safetyNotes } = body;

    if (!dogId) {
      return NextResponse.json({ error: "dogId is required" }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Dog name is required" }, { status: 400 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify dog belongs to client
    const { data: dog } = await supabase
      .from("dogs")
      .select("id")
      .eq("id", dogId)
      .eq("client_id", client.id)
      .single();

    if (!dog) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("dogs")
      .update({
        name: name.trim(),
        breed: breed?.trim() || null,
        is_safe: isSafe ?? true,
        safety_notes: safetyNotes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dogId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update dog" }, { status: 500 });
    }

    return NextResponse.json({ message: "Dog updated successfully" });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * POST /api/client/dogs
 * Add a new dog
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { name, breed, isSafe, safetyNotes } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Dog name is required" }, { status: 400 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id, org_id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: newDog, error: insertError } = await supabase
      .from("dogs")
      .insert({
        org_id: client.org_id,
        client_id: client.id,
        name: name.trim(),
        breed: breed?.trim() || null,
        is_safe: isSafe ?? true,
        safety_notes: safetyNotes?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to add dog" }, { status: 500 });
    }

    return NextResponse.json({
      dog: {
        id: newDog.id,
        name: newDog.name,
        breed: newDog.breed,
        isSafe: newDog.is_safe,
        safetyNotes: newDog.safety_notes,
      },
      message: "Dog added successfully",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * DELETE /api/client/dogs
 * Remove a dog
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can access this endpoint" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const dogId = searchParams.get("dogId");

    if (!dogId) {
      return NextResponse.json({ error: "dogId is required" }, { status: 400 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify dog belongs to client
    const { data: dog } = await supabase
      .from("dogs")
      .select("id")
      .eq("id", dogId)
      .eq("client_id", client.id)
      .single();

    if (!dog) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("dogs")
      .delete()
      .eq("id", dogId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove dog" }, { status: 500 });
    }

    return NextResponse.json({ message: "Dog removed successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to remove dog" }, { status: 500 });
  }
}
