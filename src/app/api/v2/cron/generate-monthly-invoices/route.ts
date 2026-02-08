/**
 * Monthly Invoice Generation Cron
 *
 * Runs on the 1st of every month. For each active client with an active
 * subscription, creates a DRAFT invoice with line items for:
 *   - Each active subscription (monthly rate)
 *   - Each active client cross-sell
 *
 * GET /api/v2/cron/generate-monthly-invoices
 * Authentication: CRON_SECRET Bearer token
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Round to nearest 50 cents: 0-24¢ → .00, 25-74¢ → .50, 75-99¢ → next dollar
function roundToNearest50Cents(cents: number): number {
  const remainder = cents % 100;
  const base = Math.floor(cents / 100) * 100;
  if (remainder < 25) return base;
  if (remainder < 75) return base + 50;
  return base + 100;
}

function toMonthlyCents(perVisitCents: number, frequency: string): number {
  const multipliers: Record<string, number> = {
    SEVEN_TIMES_A_WEEK: 365,
    SIX_TIMES_A_WEEK: 312,
    FIVE_TIMES_A_WEEK: 260,
    FOUR_TIMES_A_WEEK: 208,
    THREE_TIMES_A_WEEK: 156,
    TWO_TIMES_A_WEEK: 104,
    TWICE_WEEKLY: 104,
    ONCE_A_WEEK: 52,
    WEEKLY: 52,
    BI_WEEKLY: 26,
    BIWEEKLY: 26,
    EVERY_THREE_WEEKS: 17,
    EVERY_FOUR_WEEKS: 13,
    TWICE_PER_MONTH: 24,
    ONCE_A_MONTH: 12,
    MONTHLY: 12,
    ONE_TIME: 1,
    ONETIME: 1,
  };
  const mult = multipliers[frequency] || 12;
  const annualCents = perVisitCents * mult;
  return roundToNearest50Cents(Math.round(annualCents / 12));
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const billingMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 15)
      .toISOString()
      .split("T")[0]; // Due on the 15th

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id");

    if (orgsError) {
      console.error("Error fetching orgs:", orgsError);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    let totalInvoices = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const org of orgs || []) {
      try {
        // Get active subscriptions with client data and dog count
        const { data: subscriptions, error: subError } = await supabase
          .from("subscriptions")
          .select(`
            id,
            client_id,
            frequency,
            price_per_visit_cents,
            billing_interval,
            status,
            client:client_id (
              id,
              first_name,
              last_name,
              status
            )
          `)
          .eq("org_id", org.id)
          .eq("status", "ACTIVE");

        if (subError) {
          errors.push(`Org ${org.id}: Failed to fetch subscriptions - ${subError.message}`);
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) continue;

        // Group subscriptions by client
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clientSubs: Record<string, any[]> = {};
        for (const sub of subscriptions) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const client = sub.client as any;
          if (!client || client.status !== "ACTIVE") continue;
          if (!clientSubs[sub.client_id]) clientSubs[sub.client_id] = [];
          clientSubs[sub.client_id].push(sub);
        }

        // For each client, get their dogs + cross-sells and create an invoice
        for (const [clientId, subs] of Object.entries(clientSubs)) {
          try {
            // Check if an invoice already exists for this client this month
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

            const { data: existingInvoice } = await supabase
              .from("invoices")
              .select("id")
              .eq("org_id", org.id)
              .eq("client_id", clientId)
              .gte("created_at", monthStart)
              .lt("created_at", monthEnd)
              .eq("billing_interval", "MONTHLY")
              .limit(1)
              .single();

            if (existingInvoice) {
              totalSkipped++;
              continue; // Already invoiced this month
            }

            // Get active dog count
            const { data: dogs } = await supabase
              .from("dogs")
              .select("id")
              .eq("client_id", clientId)
              .eq("is_active", true);

            const dogCount = (dogs || []).length;
            const dogLabel = dogCount === 1 ? "1 Dog" : `${dogCount} Dogs`;

            // Build line items
            const lineItems: { description: string; quantity: number; unitPriceCents: number }[] = [];

            // Add subscription line items
            for (const sub of subs) {
              const freq = sub.frequency || "MONTHLY";
              const perVisitCents = sub.price_per_visit_cents || 0;
              const monthlyCents = toMonthlyCents(perVisitCents, freq);

              lineItems.push({
                description: `${freq} - ${dogLabel} (${(perVisitCents / 100).toFixed(2)}/visit)`,
                quantity: 1,
                unitPriceCents: monthlyCents,
              });
            }

            // Add client cross-sell line items
            const { data: crossSells } = await supabase
              .from("client_cross_sells")
              .select("*")
              .eq("client_id", clientId)
              .eq("is_active", true)
              .eq("status", "ACTIVE");

            for (const cs of crossSells || []) {
              lineItems.push({
                description: cs.name,
                quantity: cs.quantity || 1,
                unitPriceCents: cs.price_per_unit_cents,
              });
            }

            if (lineItems.length === 0) {
              totalSkipped++;
              continue;
            }

            // Calculate totals
            const subtotalCents = lineItems.reduce(
              (sum, item) => sum + item.quantity * item.unitPriceCents,
              0
            );

            // Generate invoice number
            const { data: latestInvoice } = await supabase
              .from("invoices")
              .select("invoice_number")
              .eq("org_id", org.id)
              .like("invoice_number", "INV-%")
              .order("invoice_number", { ascending: false })
              .limit(1)
              .single();

            let nextNumber = 1;
            if (latestInvoice?.invoice_number) {
              const match = latestInvoice.invoice_number.match(/INV-(\d+)/);
              if (match) nextNumber = parseInt(match[1], 10) + 1;
            }
            const invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`;

            // Create invoice
            const { data: newInvoice, error: invoiceError } = await supabase
              .from("invoices")
              .insert({
                org_id: org.id,
                client_id: clientId,
                invoice_number: invoiceNumber,
                status: "DRAFT",
                subtotal_cents: subtotalCents,
                tax_cents: 0,
                discount_cents: 0,
                total_cents: subtotalCents,
                amount_paid_cents: 0,
                amount_due_cents: subtotalCents,
                due_date: dueDate,
                billing_interval: "MONTHLY",
                subscription_id: subs[0].id,
                notes: `Auto-generated monthly invoice for ${billingMonth}`,
              })
              .select()
              .single();

            if (invoiceError) {
              errors.push(`Client ${clientId}: Failed to create invoice - ${invoiceError.message}`);
              continue;
            }

            // Create line items
            const invoiceItems = lineItems.map((item) => ({
              org_id: org.id,
              invoice_id: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price_cents: item.unitPriceCents,
              total_cents: item.quantity * item.unitPriceCents,
            }));

            const { error: itemsError } = await supabase
              .from("invoice_items")
              .insert(invoiceItems);

            if (itemsError) {
              errors.push(`Invoice ${invoiceNumber}: Failed to create line items - ${itemsError.message}`);
            }

            totalInvoices++;
          } catch (err) {
            errors.push(`Client ${clientId}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Org ${org.id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${totalInvoices} invoices, skipped ${totalSkipped}`,
      invoicesCreated: totalInvoices,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in generate-monthly-invoices cron:", error);
    return NextResponse.json(
      { error: "An error occurred during invoice generation" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
