/**
 * Single Invoice API
 *
 * GET /api/admin/invoices/[id] - Get invoice by ID
 * PUT /api/admin/invoices/[id] - Update invoice items and details
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import { getStripe, listPaymentMethods } from "@/lib/stripe";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "invoices:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;
  const supabase = getSupabase();

  // Fetch invoice with client and items
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      status,
      subtotal_cents,
      discount_cents,
      tax_cents,
      total_cents,
      amount_paid_cents,
      amount_due_cents,
      tip_cents,
      due_date,
      paid_at,
      notes,
      billing_option,
      billing_interval,
      payment_method,
      subscription_id,
      created_at,
      client:client_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        stripe_customer_id
      ),
      invoice_items (
        id,
        description,
        quantity,
        unit_price_cents,
        total_cents
      )
    `
    )
    .eq("id", id)
    .eq("org_id", auth.user.orgId)
    .single();

  if (error || !invoice) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientData = invoice.client as any;

  // Self-healing check: If invoice shows as OPEN/UNCOLLECTIBLE, verify against Stripe
  // to see if there's actually a successful payment we missed updating
  let invoiceStatus = invoice.status;
  let invoicePaidAt = invoice.paid_at;
  let invoiceAmountPaidCents = invoice.amount_paid_cents;
  let invoiceAmountDueCents = invoice.amount_due_cents;

  if ((invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE") && clientData?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      // Search for successful PaymentIntents with this invoice_id in metadata
      const paymentIntents = await stripe.paymentIntents.list({
        customer: clientData.stripe_customer_id,
        limit: 10,
      });

      // Find a successful payment that matches this invoice
      const successfulPayment = paymentIntents.data.find(
        (pi) =>
          pi.status === "succeeded" &&
          pi.metadata?.invoice_id === invoice.id &&
          pi.amount === invoice.total_cents
      );

      if (successfulPayment) {
        console.log(`Auto-healing invoice ${invoice.invoice_number}: Found successful Stripe payment ${successfulPayment.id}`);

        // Update the invoice in the database
        const { error: healError } = await supabase
          .from("invoices")
          .update({
            status: "PAID",
            amount_paid_cents: invoice.total_cents,
            amount_due_cents: 0,
            paid_at: new Date(successfulPayment.created * 1000).toISOString(),
            payment_method: "card",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .eq("org_id", auth.user.orgId);

        if (!healError) {
          // Update local variables for the response
          invoiceStatus = "PAID";
          invoicePaidAt = new Date(successfulPayment.created * 1000).toISOString();
          invoiceAmountPaidCents = invoice.total_cents;
          invoiceAmountDueCents = 0;

          // Log the auto-heal
          await supabase.from("activity_logs").insert({
            org_id: auth.user.orgId,
            user_id: auth.user.id,
            action: "INVOICE_AUTO_HEALED",
            entity_type: "INVOICE",
            entity_id: invoice.id,
            details: {
              invoiceNumber: invoice.invoice_number,
              paymentIntentId: successfulPayment.id,
              previousStatus: invoice.status,
            },
          });
        } else {
          console.error("Failed to auto-heal invoice:", healError);
        }
      }
    } catch (e) {
      console.error("Error checking Stripe for invoice payment:", e);
    }
  }

  // Get client's primary address if available
  let clientAddress = null;
  if (clientData?.id) {
    const { data: location } = await supabase
      .from("client_locations")
      .select("address_line1, city, state, zip_code")
      .eq("client_id", clientData.id)
      .eq("is_primary", true)
      .single();

    if (location) {
      clientAddress = `${location.address_line1}, ${location.city}, ${location.state} ${location.zip_code}`;
    }
  }

  // Get default payment method if client has Stripe customer
  let defaultCard: { brand: string; last4: string } | null = null;
  if (clientData?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const stripeCustomer = await stripe.customers.retrieve(clientData.stripe_customer_id);

      if (!stripeCustomer.deleted) {
        const defaultPmId = stripeCustomer.invoice_settings?.default_payment_method as string | null;

        if (defaultPmId) {
          const pm = await stripe.paymentMethods.retrieve(defaultPmId);
          if (pm.card) {
            defaultCard = {
              brand: pm.card.brand,
              last4: pm.card.last4,
            };
          }
        } else {
          // No default set, try to get first card
          const paymentMethods = await listPaymentMethods(clientData.stripe_customer_id);
          if (paymentMethods.length > 0 && paymentMethods[0].card) {
            defaultCard = {
              brand: paymentMethods[0].card.brand,
              last4: paymentMethods[0].card.last4,
            };
          }
        }
      }
    } catch (e) {
      console.error("Error fetching payment method:", e);
    }
  }

  // Format response
  const client = clientData ? {
    id: clientData.id as string,
    first_name: clientData.first_name as string,
    last_name: clientData.last_name as string,
    email: clientData.email as string | null,
    phone: clientData.phone as string | null,
  } : null;

  const formattedInvoice = {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    status: invoiceStatus,
    subtotalCents: invoice.subtotal_cents || 0,
    discountCents: invoice.discount_cents || 0,
    taxCents: invoice.tax_cents || 0,
    tipCents: invoice.tip_cents || 0,
    totalCents: invoice.total_cents || 0,
    amountPaidCents: invoiceAmountPaidCents || 0,
    amountDueCents: invoiceAmountDueCents || 0,
    dueDate: invoice.due_date,
    paidAt: invoicePaidAt,
    notes: invoice.notes,
    billingOption: invoice.billing_option,
    billingInterval: invoice.billing_interval,
    paymentMethod: invoice.payment_method,
    subscriptionId: invoice.subscription_id,
    createdAt: invoice.created_at,
    client: client
      ? {
          id: client.id,
          firstName: client.first_name,
          lastName: client.last_name,
          email: client.email,
          phone: client.phone,
          address: clientAddress,
        }
      : null,
    items: invoice.invoice_items || [],
    defaultCard,
  };

  return NextResponse.json({ invoice: formattedInvoice });
}

/**
 * PUT /api/admin/invoices/[id]
 * Update invoice items and details (for draft invoices)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "invoices:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { items, notes, finalize } = body;

    // Fetch existing invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, status, invoice_number")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow editing draft invoices
    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft invoices can be edited" },
        { status: 400 }
      );
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one line item is required" },
        { status: 400 }
      );
    }

    // Delete existing items
    await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", id);

    // Calculate totals
    let subtotalCents = 0;
    const newItems = items.map(
      (item: {
        description: string;
        quantity: number;
        unitPriceCents: number;
      }) => {
        const totalCents = item.quantity * item.unitPriceCents;
        subtotalCents += totalCents;
        return {
          org_id: auth.user!.orgId,
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_cents: totalCents,
        };
      }
    );

    // Insert new items
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(newItems);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      return NextResponse.json(
        { error: "Failed to update invoice items" },
        { status: 500 }
      );
    }

    // Calculate tax (could be made org-configurable in the future)
    const taxRate = 0;
    const taxCents = Math.round(subtotalCents * (taxRate / 100));
    const totalCents = subtotalCents + taxCents;

    // Update invoice
    const updateData: Record<string, unknown> = {
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      amount_due_cents: totalCents,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    // Finalize = change status to OPEN
    if (finalize) {
      updateData.status = "OPEN";
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", id);

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
      action: finalize ? "INVOICE_FINALIZED" : "INVOICE_UPDATED",
      entity_type: "INVOICE",
      entity_id: id,
      details: {
        invoiceNumber: invoice.invoice_number,
        subtotalCents,
        totalCents,
        itemCount: items.length,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id,
        status: finalize ? "OPEN" : "DRAFT",
        subtotalCents,
        taxCents,
        totalCents,
      },
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}
