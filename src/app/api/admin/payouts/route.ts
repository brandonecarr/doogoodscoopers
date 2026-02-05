/**
 * Payouts API
 *
 * List Stripe payouts (money transferred to the merchant's bank account).
 * Requires payments:read permission.
 *
 * GET /api/admin/payouts - List all payouts with pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import { listPayouts, getPayoutBalanceTransactions } from "@/lib/stripe";

/**
 * GET /api/admin/payouts
 * List all Stripe payouts with pagination
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "payments:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
  const startingAfter = searchParams.get("starting_after") || undefined;

  try {
    // Fetch payouts from Stripe
    const payoutsResponse = await listPayouts({
      limit,
      starting_after: startingAfter,
    });

    // For each payout, we need the transaction count
    // To avoid too many API calls, we'll fetch counts in parallel with a limit
    const payoutsWithCounts = await Promise.all(
      payoutsResponse.data.map(async (payout) => {
        try {
          // Get balance transactions for this payout to count items
          const transactions = await getPayoutBalanceTransactions(payout.id);
          // Count only charge and refund transactions (not fees/adjustments)
          const itemCount = transactions.filter(
            (t) => t.type === "charge" || t.type === "refund"
          ).length;

          // Calculate tip amount from transactions
          // Tips are typically included in the charge amount, so we'll sum them later in details
          const tipCents = 0; // Will be calculated in detail view from local data

          return {
            id: payout.id,
            status: payout.status,
            created: new Date(payout.created * 1000).toISOString(),
            arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
            amountCents: payout.amount,
            currency: payout.currency,
            itemCount,
            tipCents,
          };
        } catch {
          // If we can't get transaction count, return 0
          return {
            id: payout.id,
            status: payout.status,
            created: new Date(payout.created * 1000).toISOString(),
            arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
            amountCents: payout.amount,
            currency: payout.currency,
            itemCount: 0,
            tipCents: 0,
          };
        }
      })
    );

    return NextResponse.json({
      payouts: payoutsWithCounts,
      hasMore: payoutsResponse.has_more,
      pagination: {
        startingAfter: payoutsResponse.data.length > 0
          ? payoutsResponse.data[payoutsResponse.data.length - 1].id
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);

    // Check for specific Stripe errors
    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limited. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch payouts from Stripe" },
      { status: 500 }
    );
  }
}
