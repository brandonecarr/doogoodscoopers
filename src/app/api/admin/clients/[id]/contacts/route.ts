/**
 * Client Contacts API
 *
 * GET /api/admin/clients/[id]/contacts - List all contacts for a client
 * POST /api/admin/clients/[id]/contacts - Create a new contact
 * PUT /api/admin/clients/[id]/contacts - Update a contact
 * DELETE /api/admin/clients/[id]/contacts - Delete a contact
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/clients/[id]/contacts
 * List all contacts for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Fetch contacts
  const { data: contacts, error } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }

  return NextResponse.json({ contacts: contacts || [] });
}

/**
 * POST /api/admin/clients/[id]/contacts
 * Create a new contact
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      email,
      homePhone,
      cellPhone,
      relationship,
      isPrimary,
      canAuthorize,
      receiveJobNotifications,
      receiveInvoicesEmail,
    } = body;

    // Validate required fields
    if (!firstName) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 });
    }

    if (!lastName) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("is_primary", true);
    }

    // Create contact
    const { data: newContact, error: contactError } = await supabase
      .from("client_contacts")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName || null,
        email: email?.toLowerCase() || null,
        home_phone: homePhone || null,
        cell_phone: cellPhone || null,
        relationship: relationship || null,
        is_primary: isPrimary || false,
        can_authorize: canAuthorize || false,
        receive_job_notifications: receiveJobNotifications || false,
        receive_invoices_email: receiveInvoicesEmail || false,
        notification_preferences: { email: true, sms: true },
      })
      .select()
      .single();

    if (contactError) {
      console.error("Error creating contact:", contactError);
      return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CONTACT_CREATED",
      entity_type: "CLIENT_CONTACT",
      entity_id: newContact.id,
      details: { clientId, firstName, lastName },
    });

    // Format response to camelCase
    const formattedContact = {
      id: newContact.id,
      firstName: newContact.first_name,
      middleName: newContact.middle_name,
      lastName: newContact.last_name,
      email: newContact.email,
      homePhone: newContact.home_phone,
      cellPhone: newContact.cell_phone,
      relationship: newContact.relationship,
      isPrimary: newContact.is_primary,
      canAuthorize: newContact.can_authorize,
      receiveJobNotifications: newContact.receive_job_notifications,
      receiveInvoicesEmail: newContact.receive_invoices_email,
      createdAt: newContact.created_at,
    };

    return NextResponse.json({ contact: formattedContact }, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * PUT /api/admin/clients/[id]/contacts
 * Update a contact
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      id: contactId,
      firstName,
      middleName,
      lastName,
      email,
      homePhone,
      cellPhone,
      relationship,
      isPrimary,
      canAuthorize,
      receiveJobNotifications,
      receiveInvoicesEmail,
    } = body;

    if (!contactId) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    // Verify contact exists and belongs to this client
    const { data: existing } = await supabase
      .from("client_contacts")
      .select("id")
      .eq("id", contactId)
      .eq("client_id", clientId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("is_primary", true)
        .neq("id", contactId);
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (firstName !== undefined) updates.first_name = firstName;
    if (middleName !== undefined) updates.middle_name = middleName || null;
    if (lastName !== undefined) updates.last_name = lastName || null;
    if (email !== undefined) updates.email = email?.toLowerCase() || null;
    if (homePhone !== undefined) updates.home_phone = homePhone || null;
    if (cellPhone !== undefined) updates.cell_phone = cellPhone || null;
    if (relationship !== undefined) updates.relationship = relationship || null;
    if (isPrimary !== undefined) updates.is_primary = isPrimary;
    if (canAuthorize !== undefined) updates.can_authorize = canAuthorize;
    if (receiveJobNotifications !== undefined) updates.receive_job_notifications = receiveJobNotifications;
    if (receiveInvoicesEmail !== undefined) updates.receive_invoices_email = receiveInvoicesEmail;

    const { data: updatedContact, error: updateError } = await supabase
      .from("client_contacts")
      .update(updates)
      .eq("id", contactId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating contact:", updateError);
      return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CONTACT_UPDATED",
      entity_type: "CLIENT_CONTACT",
      entity_id: contactId,
      details: { clientId, updates },
    });

    return NextResponse.json({ contact: updatedContact });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/clients/[id]/contacts
 * Delete a contact
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  // Verify client belongs to org
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");

  if (!contactId) {
    return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
  }

  // Verify contact exists and belongs to this client
  const { data: existing } = await supabase
    .from("client_contacts")
    .select("id, first_name, last_name")
    .eq("id", contactId)
    .eq("client_id", clientId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Delete contact
  const { error: deleteError } = await supabase
    .from("client_contacts")
    .delete()
    .eq("id", contactId);

  if (deleteError) {
    console.error("Error deleting contact:", deleteError);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }

  // Log activity
  await supabase.from("activity_logs").insert({
    org_id: auth.user.orgId,
    user_id: auth.user.id,
    action: "CONTACT_DELETED",
    entity_type: "CLIENT_CONTACT",
    entity_id: contactId,
    details: { clientId, firstName: existing.first_name, lastName: existing.last_name },
  });

  return NextResponse.json({ success: true });
}
