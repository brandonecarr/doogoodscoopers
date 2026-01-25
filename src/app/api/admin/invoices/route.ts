/**
 * Invoices Management API
 *
 * CRUD operations for invoice management.
 * Requires invoices:read for GET, invoices:write for management.
 *
 * GET /api/admin/invoices - List all invoices with filters
 * POST /api/admin/invoices - Create new invoice
 * PUT /api/admin/invoices - Update invoice
 * DELETE /api/admin/invoices - Void invoice
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

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "PARTIAL" | "OVERDUE" | "VOID";
const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE", "VOID"];

/**
 * GET /api/admin/invoices
 * List all invoices with related data
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let query = supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      status,
      total_cents,
      subtotal_cents,
      tax_cents,
      discount_cents,
      paid_cents,
      due_date,
      issued_date,
      paid_at,
      notes,
      created_at,
      updated_at,
      client:client_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      invoice_items (
        id,
        description,
        quantity,
        unit_price_cents,
        total_cents
      )
    `,
      { count: "exact" }
    )
    .eq("org_id", auth.user.orgId)
    .order("created_at", { ascending: false });

  // Filter by status
  if (status && INVOICE_STATUSES.includes(status as InvoiceStatus)) {
    query = query.eq("status", status);
  }

  // Filter by client
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  // Filter by date range
  if (startDate) {
    query = query.gte("issued_date", startDate);
  }
  if (endDate) {
    query = query.lte("issued_date", endDate);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: invoices, error, count } = await query;

  if (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }

  // Get stats
  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("status, total_cents, paid_cents")
    .eq("org_id", auth.user.orgId);

  const stats = {
    total: allInvoices?.length || 0,
    draft: allInvoices?.filter((i) => i.status === "DRAFT").length || 0,
    sent: allInvoices?.filter((i) => i.status === "SENT").length || 0,
    paid: allInvoices?.filter((i) => i.status === "PAID").length || 0,
    overdue: allInvoices?.filter((i) => i.status === "OVERDUE").length || 0,
    totalAmountCents: allInvoices?.reduce((sum, i) => sum + i.total_cents, 0) || 0,
    paidAmountCents: allInvoices?.reduce((sum, i) => sum + (i.paid_cents || 0), 0) || 0,
    outstandingCents: allInvoices
      ?.filter((i) => !["PAID", "VOID"].includes(i.status))
      .reduce((sum, i) => sum + (i.total_cents - (i.paid_cents || 0)), 0) || 0,
  };

  // Format invoices
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedInvoices = (invoices || []).map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    status: inv.status,
    totalCents: inv.total_cents,
    subtotalCents: inv.subtotal_cents,
    taxCents: inv.tax_cents,
    discountCents: inv.discount_cents,
    paidCents: inv.paid_cents || 0,
    balanceCents: inv.total_cents - (inv.paid_cents || 0),
    dueDate: inv.due_date,
    issuedDate: inv.issued_date,
    paidAt: inv.paid_at,
    notes: inv.notes,
    createdAt: inv.created_at,
    client: inv.client
      ? {
          id: inv.client.id,
          name: [inv.client.first_name, inv.client.last_name].filter(Boolean).join(" "),
          email: inv.client.email,
          phone: inv.client.phone,
        }
      : null,
    items: inv.invoice_items || [],
    itemCount: inv.invoice_items?.length || 0,
  }));

  // Search filter (client-side for now)
  let filteredInvoices = formattedInvoices;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredInvoices = formattedInvoices.filter(
      (inv) =>
        inv.invoiceNumber?.toLowerCase().includes(searchLower) ||
        inv.client?.name?.toLowerCase().includes(searchLower) ||
        inv.client?.email?.toLowerCase().includes(searchLower)
    );
  }

  return NextResponse.json({
    invoices: filteredInvoices,
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
 * POST /api/admin/invoices
 * Create a new invoice
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      clientId,
      dueDate,
      notes,
      items,
      taxRate = 0,
      discountCents = 0,
    } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one line item is required" },
        { status: 400 }
      );
    }

    // Verify client exists
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Calculate totals
    const subtotalCents = items.reduce(
      (sum: number, item: { quantity: number; unitPriceCents: number }) =>
        sum + item.quantity * item.unitPriceCents,
      0
    );
    const taxCents = Math.round(subtotalCents * (taxRate / 100));
    const totalCents = subtotalCents + taxCents - discountCents;

    // Generate invoice number
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("org_id", auth.user.orgId);

    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(5, "0")}`;

    // Create invoice
    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: auth.user.orgId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        status: "DRAFT",
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        discount_cents: discountCents,
        total_cents: totalCents,
        paid_cents: 0,
        due_date: dueDate || null,
        issued_date: new Date().toISOString().split("T")[0],
        notes: notes || null,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    // Create line items
    const invoiceItems = items.map(
      (item: { description: string; quantity: number; unitPriceCents: number }) => ({
        org_id: auth.user!.orgId,
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        total_cents: item.quantity * item.unitPriceCents,
      })
    );

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      console.warn("Error creating invoice items:", itemsError);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "INVOICE_CREATED",
      entity_type: "INVOICE",
      entity_id: newInvoice.id,
      details: { invoiceNumber, totalCents, clientId },
    });

    return NextResponse.json({ invoice: newInvoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/invoices
 * Update an invoice (status, mark paid, etc.)
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, status, paidCents, notes, dueDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Verify invoice belongs to org
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, status, total_cents, paid_cents")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status !== undefined && INVOICE_STATUSES.includes(status)) {
      updates.status = status;

      // Handle status-specific updates
      if (status === "PAID") {
        updates.paid_cents = existing.total_cents;
        updates.paid_at = new Date().toISOString();
      } else if (status === "SENT" && existing.status === "DRAFT") {
        updates.issued_date = new Date().toISOString().split("T")[0];
      }
    }

    if (paidCents !== undefined) {
      updates.paid_cents = paidCents;
      // Auto-update status based on payment
      if (paidCents >= existing.total_cents) {
        updates.status = "PAID";
        updates.paid_at = new Date().toISOString();
      } else if (paidCents > 0) {
        updates.status = "PARTIAL";
      }
    }

    if (notes !== undefined) updates.notes = notes;
    if (dueDate !== undefined) updates.due_date = dueDate;

    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "INVOICE_UPDATED",
      entity_type: "INVOICE",
      entity_id: id,
      details: { updates },
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/invoices
 * Void an invoice
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:void");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Verify invoice belongs to org
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (existing.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot void a paid invoice" },
        { status: 400 }
      );
    }

    // Void the invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "VOID", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Error voiding invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to void invoice" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "INVOICE_VOIDED",
      entity_type: "INVOICE",
      entity_id: id,
      details: { invoiceNumber: existing.invoice_number },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error voiding invoice:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
