/**
 * Single Invoice API
 *
 * GET /api/admin/invoices/[id] - Get invoice by ID
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
    status: invoice.status,
    subtotalCents: invoice.subtotal_cents || 0,
    discountCents: invoice.discount_cents || 0,
    taxCents: invoice.tax_cents || 0,
    tipCents: invoice.tip_cents || 0,
    totalCents: invoice.total_cents || 0,
    amountPaidCents: invoice.amount_paid_cents || 0,
    amountDueCents: invoice.amount_due_cents || 0,
    dueDate: invoice.due_date,
    paidAt: invoice.paid_at,
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
