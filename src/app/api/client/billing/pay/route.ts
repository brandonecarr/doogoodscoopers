/**
 * Client Payment API
 *
 * Create a Stripe Checkout session for paying open balance.
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
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(secretKey);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    // Get client with Stripe customer ID
    const { data: client } = await supabase
      .from("clients")
      .select("id, stripe_customer_id, org_id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.stripe_customer_id) {
      return NextResponse.json(
        { error: "No payment method on file. Please contact us to set up billing." },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: client.stripe_customer_id,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Account Balance Payment",
              description: "Payment towards open balance",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/app/client/billing?success=true`,
      cancel_url: `${origin}/app/client/billing?canceled=true`,
      metadata: {
        client_id: client.id,
        org_id: client.org_id,
        payment_type: "balance_payment",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }
}
