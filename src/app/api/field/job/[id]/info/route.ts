/**
 * Field Job Client Info API
 *
 * Get full client and location info for the field tech app
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

const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field/job/[id]/info
 * Get full client and location info for a job
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

  // Get the job with client and location info
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      status,
      scheduled_date,
      notes,
      client_id,
      location_id,
      client:client_id (
        id,
        first_name,
        last_name,
        phone,
        email,
        secondary_phone
      ),
      location:location_id (
        id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        latitude,
        longitude,
        gate_code,
        gate_location,
        access_notes,
        service_areas
      )
    `)
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = job.client as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const location = job.location as any;

  // Get contacts for the client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contacts: any[] = [];
  if (job.client_id) {
    const { data: clientContacts } = await supabase
      .from("client_contacts")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        relationship,
        is_primary
      `)
      .eq("client_id", job.client_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    contacts = clientContacts || [];
  }

  // If no separate contacts, use client as the primary contact
  if (contacts.length === 0 && client) {
    contacts = [{
      id: client.id,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone,
      secondary_phone: client.secondary_phone,
      relationship: null,
      is_primary: true
    }];
  }

  // Get dogs for the location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dogs: any[] = [];
  if (location?.id) {
    const { data: locationDogs } = await supabase
      .from("dogs")
      .select(`
        id,
        name,
        breed,
        size,
        color,
        is_safe,
        safety_notes,
        special_instructions
      `)
      .eq("location_id", location.id);

    dogs = locationDogs || [];
  }

  // Get active subscription and its add-ons for this location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let additionalServices: any[] = [];
  if (location?.id) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(`
        id,
        subscription_add_ons (
          id,
          quantity,
          add_on:add_on_id (
            id,
            name,
            description
          )
        )
      `)
      .eq("location_id", location.id)
      .eq("status", "ACTIVE")
      .single();

    if (subscription?.subscription_add_ons) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      additionalServices = subscription.subscription_add_ons.map((sa: any) => ({
        id: sa.add_on?.id,
        name: sa.add_on?.name,
        description: sa.add_on?.description,
        quantity: sa.quantity
      })).filter((s: { id: string | null }) => s.id);
    }
  }

  // Get recent cleanups (last 10 completed jobs for this location)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentCleanups: any[] = [];
  if (location?.id) {
    const { data: recentJobs } = await supabase
      .from("jobs")
      .select(`
        id,
        scheduled_date,
        status,
        completed_at,
        assigned_tech:assigned_to (
          id,
          first_name,
          last_name
        )
      `)
      .eq("location_id", location.id)
      .eq("org_id", auth.user.orgId)
      .in("status", ["COMPLETED", "SKIPPED"])
      .order("scheduled_date", { ascending: false })
      .limit(10);

    if (recentJobs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentCleanups = recentJobs.map((j: any) => ({
        id: j.id,
        date: j.scheduled_date,
        status: j.status,
        completedAt: j.completed_at,
        techName: j.assigned_tech
          ? `${j.assigned_tech.first_name || ""} ${j.assigned_tech.last_name || ""}`.trim()
          : null
      }));
    }
  }

  return NextResponse.json({
    client: client ? {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
    } : null,
    location: location ? {
      id: location.id,
      addressLine1: location.address_line1,
      addressLine2: location.address_line2,
      city: location.city,
      state: location.state,
      zipCode: location.zip_code,
      lat: location.latitude,
      lng: location.longitude,
      gateCode: location.gate_code,
      gateLocation: location.gate_location,
      accessNotes: location.access_notes,
      serviceAreas: location.service_areas,
    } : null,
    jobNotes: job.notes,
    contacts: contacts.map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      cellPhone: c.phone,
      homePhone: c.secondary_phone || null,
      relationship: c.relationship,
      isPrimary: c.is_primary
    })),
    dogs: dogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      size: d.size,
      color: d.color,
      isSafe: d.is_safe,
      safetyNotes: d.safety_notes,
      specialInstructions: d.special_instructions
    })),
    additionalServices,
    recentCleanups
  });
}
