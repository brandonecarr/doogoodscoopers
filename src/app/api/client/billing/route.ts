/**
 * Client Billing API
 *
 * Returns invoices, payments, and billing info for the authenticated client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select(`
        id,
        account_credit_cents,
        stripe_customer_id
      `)
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get invoices
    const { data: invoices, count } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        status,
        total_cents,
        paid_cents,
        due_date,
        created_at,
        paid_at
      `, { count: "exact" })
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Get recent payments
    const { data: payments } = await supabase
      .from("payments")
      .select(`
        id,
        amount_cents,
        status,
        payment_method,
        created_at,
        invoice:invoice_id (
          invoice_number
        )
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate totals
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("total_cents, paid_cents, status")
      .eq("client_id", client.id);

    const totals = {
      totalBilled: allInvoices?.reduce((sum, inv) => sum + inv.total_cents, 0) || 0,
      totalPaid: allInvoices?.reduce((sum, inv) => sum + (inv.paid_cents || 0), 0) || 0,
      openBalance: allInvoices
        ?.filter((inv) => inv.status === "UNPAID")
        .reduce((sum, inv) => sum + (inv.total_cents - (inv.paid_cents || 0)), 0) || 0,
      accountCredit: client.account_credit_cents || 0,
    };

    // Get gift certificate balance
    const { data: giftCerts } = await supabase
      .from("gift_certificate_redemptions")
      .select(`
        id,
        amount_cents,
        gift_certificate:gift_certificates (
          code,
          original_amount_cents
        )
      `)
      .eq("client_id", client.id)
      .eq("status", "APPLIED");

    // Calculate total remaining gift certificate balance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const giftCertBalance = giftCerts?.reduce((sum: number, r: any) => sum + (r.amount_cents || 0), 0) || 0;

    // Get Stripe payment methods if customer exists
    interface PaymentMethod {
      id: string;
      type: string;
      brand: string | null;
      last4: string | null;
      expMonth: number | null;
      expYear: number | null;
      isDefault: boolean;
    }
    let paymentMethods: PaymentMethod[] = [];
    const stripe = getStripe();
    if (stripe && client.stripe_customer_id) {
      try {
        const stripePaymentMethods = await stripe.paymentMethods.list({
          customer: client.stripe_customer_id,
          type: "card",
        });

        // Get default payment method
        const customer = await stripe.customers.retrieve(client.stripe_customer_id);
        const defaultPmId = !customer.deleted && customer.invoice_settings?.default_payment_method;

        paymentMethods = stripePaymentMethods.data.map((pm) => ({
          id: pm.id,
          type: pm.type,
          brand: pm.card?.brand || null,
          last4: pm.card?.last4 || null,
          expMonth: pm.card?.exp_month || null,
          expYear: pm.card?.exp_year || null,
          isDefault: pm.id === defaultPmId,
        }));
      } catch (err) {
        console.error("Error fetching Stripe payment methods:", err);
      }
    }

    // Format invoices
    const formattedInvoices = (invoices || []).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      status: inv.status,
      totalCents: inv.total_cents,
      paidCents: inv.paid_cents || 0,
      balanceCents: inv.total_cents - (inv.paid_cents || 0),
      dueDate: inv.due_date,
      createdAt: inv.created_at,
      paidAt: inv.paid_at,
    }));

    // Format payments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedPayments = (payments || []).map((pmt: any) => ({
      id: pmt.id,
      amountCents: pmt.amount_cents,
      status: pmt.status,
      paymentMethod: pmt.payment_method,
      createdAt: pmt.created_at,
      invoiceNumber: pmt.invoice?.invoice_number,
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      payments: formattedPayments,
      paymentMethods,
      totals: {
        ...totals,
        giftCertBalance,
      },
      hasStripeCustomer: !!client.stripe_customer_id,
      stripeCustomerId: client.stripe_customer_id,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching billing:", error);
    return NextResponse.json({ error: "Failed to fetch billing" }, { status: 500 });
  }
}
