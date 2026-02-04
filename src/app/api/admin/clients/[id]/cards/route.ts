/**
 * Client Credit Cards API (Admin)
 *
 * GET  /api/admin/clients/[id]/cards - List payment methods from Stripe
 * POST /api/admin/clients/[id]/cards - Create SetupIntent for adding a card
 * PUT  /api/admin/clients/[id]/cards - Set default payment method
 * DELETE /api/admin/clients/[id]/cards - Detach a payment method
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import {
  listPaymentMethods,
  createSetupIntent,
  getOrCreateStripeCustomer,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  getStripe,
} from "@/lib/stripe";

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
 * GET /api/admin/clients/[id]/cards
 * List payment methods from Stripe
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id, stripe_customer_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.stripe_customer_id) {
    return NextResponse.json({ cards: [] });
  }

  try {
    const stripe = getStripe();
    const paymentMethods = await listPaymentMethods(client.stripe_customer_id);

    // Get default payment method
    const customer = await stripe.customers.retrieve(client.stripe_customer_id);
    const defaultPmId =
      !customer.deleted && customer.invoice_settings?.default_payment_method;

    const cards = paymentMethods.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || null,
      last4: pm.card?.last4 || null,
      expMonth: pm.card?.exp_month || null,
      expYear: pm.card?.exp_year || null,
      name: pm.billing_details?.name || null,
      isDefault: pm.id === defaultPmId,
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients/[id]/cards
 * Create a SetupIntent for adding a card
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const customer = await getOrCreateStripeCustomer(clientId);
    const setupIntent = await createSetupIntent(customer.id);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      stripeCustomerId: customer.id,
    });
  } catch (error) {
    console.error("Error creating SetupIntent:", error);
    return NextResponse.json(
      { error: "Failed to initialize card setup" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/clients/[id]/cards
 * Set default payment method
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id, stripe_customer_id")
    .eq("id", clientId)
    .single();

  if (!client || client.org_id !== auth.user.orgId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.stripe_customer_id) {
    return NextResponse.json(
      { error: "Client has no Stripe customer" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    await setDefaultPaymentMethod(client.stripe_customer_id, paymentMethodId);

    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "DEFAULT_CARD_SET",
      entity_type: "CLIENT",
      entity_id: clientId,
      details: { paymentMethodId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return NextResponse.json(
      { error: "Failed to set default payment method" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]/cards
 * Detach a payment method
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateWithPermission(request, "clients:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: clientId } = await params;
  const supabase = getSupabase();

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
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    await detachPaymentMethod(paymentMethodId);

    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "CARD_DELETED",
      entity_type: "CLIENT",
      entity_id: clientId,
      details: { paymentMethodId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error detaching payment method:", error);
    return NextResponse.json(
      { error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
