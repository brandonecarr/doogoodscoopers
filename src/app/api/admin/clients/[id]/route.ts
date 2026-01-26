/**
 * Single Client API
 *
 * GET /api/admin/clients/[id] - Get detailed client info
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
 * GET /api/admin/clients/[id]
 * Get detailed client information
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;
  const supabase = getSupabase();

  // First, check if client exists at all (for better error message)
  const { data: clientCheck, error: checkError } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", id)
    .single();

  if (checkError || !clientCheck) {
    console.error("Client lookup failed:", checkError?.message || "No client found with ID", id);
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Check if client belongs to user's org
  if (clientCheck.org_id !== auth.user.orgId) {
    console.error(`Access denied: Client ${id} belongs to org ${clientCheck.org_id}, user is in org ${auth.user.orgId}`);
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Fetch client with all related data - use * for related tables to get all available columns
  const { data: client, error } = await supabase
    .from("clients")
    .select(
      `
      *,
      locations (*),
      dogs (*),
      subscriptions (*)
    `
    )
    .eq("id", id)
    .single();

  if (error || !client) {
    console.error("Error fetching client details:", error?.message, error?.details, error?.hint);
    return NextResponse.json({ error: "Failed to fetch client details" }, { status: 500 });
  }

  // Fetch recent jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      `
      id,
      status,
      scheduled_date,
      completed_at,
      skipped_at,
      skip_reason,
      notes,
      tech_notes,
      created_at
    `
    )
    .eq("client_id", id)
    .order("scheduled_date", { ascending: false })
    .limit(20);

  // Fetch recent invoices/payments
  const { data: payments } = await supabase
    .from("payments")
    .select(
      `
      id,
      amount_cents,
      status,
      payment_type,
      stripe_payment_intent_id,
      invoice_number,
      invoice_date,
      due_date,
      paid_at,
      created_at
    `
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch client contacts
  const { data: contacts } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  // Fetch assigned tech info if subscription has one
  let assignedTech = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeSubscription = (client.subscriptions as any[])?.find(
    (s) => s.status === "ACTIVE"
  );
  if (activeSubscription?.assigned_tech_id) {
    const { data: tech } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("id", activeSubscription.assigned_tech_id)
      .single();
    assignedTech = tech;
  }

  // Format response
  const formattedClient = {
    id: client.id,
    firstName: client.first_name,
    lastName: client.last_name,
    fullName:
      [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company_name ||
      "Unknown",
    companyName: client.company_name,
    email: client.email,
    phone: client.phone,
    secondaryPhone: client.secondary_phone,
    clientType: client.client_type,
    status: client.status,
    accountCreditCents: client.account_credit_cents,
    tags: client.tags || [],
    notes: client.notes,
    referralSource: client.referral_source,
    hasStripeCustomer: !!client.stripe_customer_id,
    notificationPreferences: client.notification_preferences,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locations: (client.locations as any[])?.map((l) => ({
      id: l.id,
      addressLine1: l.address_line1,
      addressLine2: l.address_line2,
      city: l.city,
      state: l.state,
      zipCode: l.zip_code,
      fullAddress: `${l.address_line1}${l.address_line2 ? `, ${l.address_line2}` : ""}, ${l.city}, ${l.state} ${l.zip_code}`,
      gateCode: l.gate_code,
      gateLocation: l.gate_location,
      accessNotes: l.access_notes,
      lotSize: l.lot_size,
      isPrimary: l.is_primary,
      isActive: l.is_active,
      createdAt: l.created_at,
    })) || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dogs: (client.dogs as any[])?.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      size: d.size,
      isSafe: d.is_safe,
      safetyNotes: d.safety_notes,
      isActive: d.is_active,
      createdAt: d.created_at,
    })) || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptions: (client.subscriptions as any[])?.map((s) => ({
      id: s.id,
      status: s.status,
      frequency: s.frequency,
      pricePerVisitCents: s.price_per_visit_cents,
      nextServiceDate: s.next_service_date,
      serviceDay: s.service_day,
      assignedTechId: s.assigned_tech_id,
      createdAt: s.created_at,
      canceledAt: s.canceled_at,
      cancelReason: s.cancel_reason,
    })) || [],
    assignedTech: assignedTech
      ? {
          id: assignedTech.id,
          firstName: assignedTech.first_name,
          lastName: assignedTech.last_name,
          fullName: [assignedTech.first_name, assignedTech.last_name]
            .filter(Boolean)
            .join(" "),
          email: assignedTech.email,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentJobs: (jobs as any[] | null)?.map((j) => ({
      id: j.id,
      status: j.status,
      scheduledDate: j.scheduled_date,
      completedAt: j.completed_at,
      skippedAt: j.skipped_at,
      skipReason: j.skip_reason,
      notes: j.notes,
      techNotes: j.tech_notes,
      createdAt: j.created_at,
    })) || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentPayments: (payments as any[] | null)?.map((p) => ({
      id: p.id,
      amountCents: p.amount_cents,
      status: p.status,
      paymentType: p.payment_type,
      invoiceNumber: p.invoice_number,
      invoiceDate: p.invoice_date,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })) || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contacts: (contacts as any[] | null)?.map((c) => ({
      id: c.id,
      firstName: c.first_name,
      middleName: c.middle_name,
      lastName: c.last_name,
      email: c.email,
      homePhone: c.home_phone,
      cellPhone: c.cell_phone,
      relationship: c.relationship,
      isPrimary: c.is_primary,
      canAuthorize: c.can_authorize,
      receiveJobNotifications: c.receive_job_notifications,
      receiveInvoicesEmail: c.receive_invoices_email,
      createdAt: c.created_at,
    })) || [],
  };

  return NextResponse.json({ client: formattedClient });
}
