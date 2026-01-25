/**
 * Clients Management API
 *
 * CRUD operations for client management.
 * Requires clients:read for GET, clients:write for management.
 *
 * GET /api/admin/clients - List all clients with filters
 * POST /api/admin/clients - Create new client
 * PUT /api/admin/clients - Update client
 * DELETE /api/admin/clients - Deactivate client (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import type { ClientStatus } from "@/lib/supabase/types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const CLIENT_STATUSES: ClientStatus[] = ["ACTIVE", "PAUSED", "CANCELED", "DELINQUENT"];

/**
 * GET /api/admin/clients
 * List all clients with related data
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const clientType = searchParams.get("type"); // RESIDENTIAL, COMMERCIAL
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;
  const sortBy = searchParams.get("sort") || "created_at";
  const sortDir = searchParams.get("dir") === "asc" ? true : false;

  let query = supabase
    .from("clients")
    .select(
      `
      id,
      first_name,
      last_name,
      company_name,
      email,
      phone,
      client_type,
      status,
      account_credit_cents,
      tags,
      notes,
      referral_source,
      stripe_customer_id,
      created_at,
      updated_at,
      locations (
        id,
        address_line1,
        city,
        state,
        zip_code,
        is_primary,
        is_active
      ),
      dogs (
        id,
        name,
        is_active
      ),
      subscriptions (
        id,
        status,
        frequency,
        price_per_visit_cents,
        next_service_date
      )
    `,
      { count: "exact" }
    )
    .eq("org_id", auth.user.orgId);

  // Filter by status
  if (status && CLIENT_STATUSES.includes(status as ClientStatus)) {
    query = query.eq("status", status);
  }

  // Filter by client type
  if (clientType === "RESIDENTIAL" || clientType === "COMMERCIAL") {
    query = query.eq("client_type", clientType);
  }

  // Search by name, email, phone, or company
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    );
  }

  // Sort
  const validSortFields = ["created_at", "first_name", "last_name", "status"];
  if (validSortFields.includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortDir });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: clients, error, count } = await query;

  if (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }

  // Get stats
  const { data: allClientsStats } = await supabase
    .from("clients")
    .select("status")
    .eq("org_id", auth.user.orgId);

  const stats = {
    total: allClientsStats?.length || 0,
    active: allClientsStats?.filter((c) => c.status === "ACTIVE").length || 0,
    paused: allClientsStats?.filter((c) => c.status === "PAUSED").length || 0,
    canceled: allClientsStats?.filter((c) => c.status === "CANCELED").length || 0,
    delinquent: allClientsStats?.filter((c) => c.status === "DELINQUENT").length || 0,
  };

  // Format clients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedClients = (clients || []).map((c: any) => {
    const primaryLocation = c.locations?.find((l: { is_primary: boolean }) => l.is_primary) || c.locations?.[0];
    const activeSubscription = c.subscriptions?.find((s: { status: string }) => s.status === "ACTIVE");
    const activeDogs = c.dogs?.filter((d: { is_active: boolean }) => d.is_active) || [];

    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      fullName: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unknown",
      companyName: c.company_name,
      email: c.email,
      phone: c.phone,
      clientType: c.client_type,
      status: c.status,
      accountCreditCents: c.account_credit_cents,
      tags: c.tags || [],
      notes: c.notes,
      referralSource: c.referral_source,
      hasStripeCustomer: !!c.stripe_customer_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      primaryAddress: primaryLocation
        ? `${primaryLocation.address_line1}, ${primaryLocation.city}, ${primaryLocation.state} ${primaryLocation.zip_code}`
        : null,
      locationCount: c.locations?.length || 0,
      dogCount: activeDogs.length,
      dogNames: activeDogs.map((d: { name: string }) => d.name).join(", "),
      subscription: activeSubscription
        ? {
            id: activeSubscription.id,
            frequency: activeSubscription.frequency,
            pricePerVisitCents: activeSubscription.price_per_visit_cents,
            nextServiceDate: activeSubscription.next_service_date,
          }
        : null,
    };
  });

  return NextResponse.json({
    clients: formattedClients,
    stats,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

/**
 * POST /api/admin/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      companyName,
      email,
      phone,
      secondaryPhone,
      clientType,
      referralSource,
      notes,
      tags,
      location,
      dogs,
    } = body;

    // Validate required fields
    if (!firstName) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    if (email) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("org_id", auth.user.orgId)
        .single();

      if (existingClient) {
        return NextResponse.json(
          { error: "A client with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Create client
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        org_id: auth.user.orgId,
        first_name: firstName,
        last_name: lastName || null,
        company_name: companyName || null,
        email: email?.toLowerCase() || null,
        phone: phone || null,
        secondary_phone: secondaryPhone || null,
        client_type: clientType || "RESIDENTIAL",
        status: "ACTIVE",
        referral_source: referralSource || null,
        notes: notes || null,
        tags: tags || [],
        notification_preferences: { email: true, sms: !!phone },
      })
      .select()
      .single();

    if (clientError) {
      console.error("Error creating client:", clientError);
      return NextResponse.json(
        { error: "Failed to create client" },
        { status: 500 }
      );
    }

    // Create location if provided
    if (location && location.addressLine1) {
      const { error: locationError } = await supabase.from("locations").insert({
        org_id: auth.user.orgId,
        client_id: newClient.id,
        address_line1: location.addressLine1,
        address_line2: location.addressLine2 || null,
        city: location.city,
        state: location.state || "CA",
        zip_code: location.zipCode,
        gate_code: location.gateCode || null,
        gate_location: location.gateLocation || null,
        access_notes: location.accessNotes || null,
        is_primary: true,
        is_active: true,
      });

      if (locationError) {
        console.warn("Error creating location:", locationError);
      }
    }

    // Create dogs if provided
    if (dogs && Array.isArray(dogs)) {
      for (const dog of dogs) {
        if (dog.name) {
          await supabase.from("dogs").insert({
            org_id: auth.user.orgId,
            client_id: newClient.id,
            name: dog.name,
            breed: dog.breed || null,
            size: dog.size || null,
            is_safe: dog.isSafe !== false,
            safety_notes: dog.safetyNotes || null,
            is_active: true,
          });
        }
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CLIENT_CREATED",
      entity_type: "CLIENT",
      entity_id: newClient.id,
      details: { firstName, lastName, email },
    });

    return NextResponse.json({ client: newClient }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/clients
 * Update a client
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      id,
      firstName,
      lastName,
      companyName,
      email,
      phone,
      secondaryPhone,
      clientType,
      status,
      referralSource,
      notes,
      tags,
      accountCreditCents,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Verify client belongs to org
    const { data: existing } = await supabase
      .from("clients")
      .select("id, email")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== existing.email) {
      const { data: existingByEmail } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("org_id", auth.user.orgId)
        .neq("id", id)
        .single();

      if (existingByEmail) {
        return NextResponse.json(
          { error: "A client with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (companyName !== undefined) updates.company_name = companyName;
    if (email !== undefined) updates.email = email?.toLowerCase() || null;
    if (phone !== undefined) updates.phone = phone;
    if (secondaryPhone !== undefined) updates.secondary_phone = secondaryPhone;
    if (clientType !== undefined) updates.client_type = clientType;
    if (status !== undefined && CLIENT_STATUSES.includes(status)) updates.status = status;
    if (referralSource !== undefined) updates.referral_source = referralSource;
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;
    if (accountCreditCents !== undefined) updates.account_credit_cents = accountCreditCents;

    const { data: updatedClient, error: updateError } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating client:", updateError);
      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CLIENT_UPDATED",
      entity_type: "CLIENT",
      entity_id: id,
      details: { updates },
    });

    return NextResponse.json({ client: updatedClient });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/clients
 * Soft delete (cancel) a client
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "clients:delete");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Verify client belongs to org
    const { data: existing } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Soft delete - mark as canceled
    const { error: updateError } = await supabase
      .from("clients")
      .update({ status: "CANCELED", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Error canceling client:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel client" },
        { status: 500 }
      );
    }

    // Cancel active subscriptions
    await supabase
      .from("subscriptions")
      .update({
        status: "CANCELED",
        canceled_at: new Date().toISOString(),
        cancel_reason: "Client canceled",
        updated_at: new Date().toISOString()
      })
      .eq("client_id", id)
      .eq("status", "ACTIVE");

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CLIENT_CANCELED",
      entity_type: "CLIENT",
      entity_id: id,
      details: { firstName: existing.first_name, lastName: existing.last_name, email: existing.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling client:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
