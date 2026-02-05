/**
 * Payout Details API
 *
 * Get details for a specific Stripe payout with enriched transaction data.
 * Links Stripe charges to local invoices and clients.
 * Requires payments:read permission.
 *
 * GET /api/admin/payouts/[id] - Get payout with transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import { getPayout, getPayoutBalanceTransactions } from "@/lib/stripe";
import Stripe from "stripe";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface EnrichedTransaction {
  id: string;
  type: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  tipCents: number;
  customerName: string | null;
  customerEmail: string | null;
  invoiceNumber: string | null;
  invoiceId: string | null;
  clientId: string | null;
  created: string;
}

/**
 * GET /api/admin/payouts/[id]
 * Get payout details with enriched transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateWithPermission(request, "payments:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { id: payoutId } = await params;

  try {
    // Fetch payout from Stripe
    const payout = await getPayout(payoutId);

    // Fetch all balance transactions for this payout
    const balanceTransactions = await getPayoutBalanceTransactions(payoutId);

    // Extract charge IDs from transactions to look up local data
    const chargeIds: string[] = [];
    for (const txn of balanceTransactions) {
      if (txn.type === "charge" && txn.source) {
        // source can be a string ID or an expanded object
        const sourceId = typeof txn.source === "string"
          ? txn.source
          : (txn.source as Stripe.Charge).id;
        chargeIds.push(sourceId);
      }
    }

    // Batch lookup local payments by stripe_charge_id
    const supabase = getSupabase();
    let paymentMap = new Map<string, {
      clientId: string | null;
      clientFirstName: string | null;
      clientLastName: string | null;
      clientEmail: string | null;
      invoiceId: string | null;
      invoiceNumber: string | null;
      tipCents: number;
    }>();

    if (chargeIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select(`
          stripe_charge_id,
          client_id,
          invoice_id,
          client:client_id (
            id,
            first_name,
            last_name,
            email
          ),
          invoice:invoice_id (
            id,
            invoice_number,
            tip_cents
          )
        `)
        .eq("org_id", auth.user.orgId)
        .in("stripe_charge_id", chargeIds);

      if (payments) {
        for (const payment of payments) {
          if (payment.stripe_charge_id) {
            // Supabase returns related records - handle both array and object formats
            const clientData = payment.client as unknown;
            const invoiceData = payment.invoice as unknown;

            const client = Array.isArray(clientData)
              ? (clientData[0] as { id: string; first_name: string | null; last_name: string | null; email: string | null } | undefined)
              : (clientData as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null);

            const invoice = Array.isArray(invoiceData)
              ? (invoiceData[0] as { id: string; invoice_number: string | null; tip_cents: number | null } | undefined)
              : (invoiceData as { id: string; invoice_number: string | null; tip_cents: number | null } | null);

            paymentMap.set(payment.stripe_charge_id, {
              clientId: client?.id || null,
              clientFirstName: client?.first_name || null,
              clientLastName: client?.last_name || null,
              clientEmail: client?.email || null,
              invoiceId: invoice?.id || null,
              invoiceNumber: invoice?.invoice_number || null,
              tipCents: invoice?.tip_cents || 0,
            });
          }
        }
      }
    }

    // Build enriched transactions
    const transactions: EnrichedTransaction[] = [];
    let totalGrossCents = 0;
    let totalFeeCents = 0;
    let totalNetCents = 0;
    let totalTipCents = 0;

    for (const txn of balanceTransactions) {
      // Only include charge and refund transactions in the list
      if (txn.type !== "charge" && txn.type !== "refund") {
        continue;
      }

      const sourceId = txn.source
        ? typeof txn.source === "string"
          ? txn.source
          : (txn.source as Stripe.Charge).id
        : null;

      const localData = sourceId ? paymentMap.get(sourceId) : null;
      const customerName = localData
        ? [localData.clientFirstName, localData.clientLastName].filter(Boolean).join(" ") || null
        : null;

      const tipCents = localData?.tipCents || 0;

      transactions.push({
        id: txn.id,
        type: txn.type,
        amountCents: txn.amount,
        feeCents: txn.fee,
        netCents: txn.net,
        tipCents,
        customerName,
        customerEmail: localData?.clientEmail || null,
        invoiceNumber: localData?.invoiceNumber || null,
        invoiceId: localData?.invoiceId || null,
        clientId: localData?.clientId || null,
        created: new Date(txn.created * 1000).toISOString(),
      });

      // Accumulate totals (charges are positive, refunds are negative)
      totalGrossCents += txn.amount;
      totalFeeCents += txn.fee;
      totalNetCents += txn.net;
      totalTipCents += tipCents;
    }

    return NextResponse.json({
      payout: {
        id: payout.id,
        status: payout.status,
        created: new Date(payout.created * 1000).toISOString(),
        arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
        grossCents: totalGrossCents,
        feeCents: totalFeeCents,
        netCents: payout.amount, // Use payout amount as the net
        tipCents: totalTipCents,
        currency: payout.currency,
      },
      transactions,
    });
  } catch (error) {
    console.error("Error fetching payout details:", error);

    // Check for specific Stripe errors
    if (error instanceof Error) {
      if (error.message.includes("No such payout")) {
        return NextResponse.json(
          { error: "Payout not found" },
          { status: 404 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limited. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch payout details" },
      { status: 500 }
    );
  }
}
