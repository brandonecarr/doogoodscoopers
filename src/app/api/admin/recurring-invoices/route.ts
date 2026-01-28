/**
 * Recurring Invoices API
 *
 * CRUD operations for recurring invoice management.
 * Recurring invoices are those linked to subscriptions (subscription_id IS NOT NULL).
 * Requires invoices:read for GET, invoices:write for management.
 *
 * GET /api/admin/recurring-invoices - List all recurring invoices with filters
 * PUT /api/admin/recurring-invoices - Bulk actions (finalize, email, delete)
 * DELETE /api/admin/recurring-invoices - Void invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import type {
  RecurringInvoice,
  RecurringInvoiceStats,
  InvoiceStatus,
  BillingOption,
  BillingInterval,
  PaymentMethod,
} from "@/lib/billing/types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "OPEN", "PAID", "OVERDUE", "VOID", "UNCOLLECTIBLE"];

/**
 * GET /api/admin/recurring-invoices
 * List all recurring invoices with filtering and stats
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const search = searchParams.get("search") || "";
  const statusParam = searchParams.get("status");
  const statuses = statusParam ? statusParam.split(",").filter(s => INVOICE_STATUSES.includes(s as InvoiceStatus)) : [];
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const billingOption = searchParams.get("billingOption") as BillingOption | null;
  const paymentMethod = searchParams.get("paymentMethod") as PaymentMethod | null;
  const clientType = searchParams.get("clientType") as "RESIDENTIAL" | "COMMERCIAL" | null;
  const showZeroInvoices = searchParams.get("showZeroInvoices") === "true";
  const withTips = searchParams.get("withTips") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    // Build the main query for recurring invoices (has subscription_id)
    let query = supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        status,
        total_cents,
        tip_cents,
        amount_paid_cents,
        amount_due_cents,
        billing_option,
        billing_interval,
        payment_method,
        created_at,
        subscription_id,
        client:client_id (
          id,
          first_name,
          last_name,
          email,
          client_type,
          company_name
        ),
        subscription:subscription_id (
          id,
          frequency,
          billing_option,
          billing_interval,
          plan:plan_id (
            name
          ),
          location:location_id (
            address_line1,
            address_line2,
            city,
            state,
            zip_code
          )
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
      .not("subscription_id", "is", null)
      .order("created_at", { ascending: false });

    // Apply filters
    if (statuses.length > 0) {
      query = query.in("status", statuses);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59`);
    }

    if (billingOption) {
      query = query.eq("billing_option", billingOption);
    }

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    if (!showZeroInvoices) {
      query = query.gt("total_cents", 0);
    }

    if (withTips) {
      query = query.gt("tip_cents", 0);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error("Error fetching recurring invoices:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    // Get stats for all recurring invoices (unfiltered by pagination)
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("status, total_cents, tip_cents")
      .eq("org_id", auth.user.orgId)
      .not("subscription_id", "is", null);

    const stats: RecurringInvoiceStats = {
      draft: { count: 0, amountCents: 0 },
      open: { count: 0, amountCents: 0 },
      overdue: { count: 0, amountCents: 0 },
      paid: { count: 0, amountCents: 0 },
      failed: { count: 0, amountCents: 0 },
      totalAmountCents: 0,
      totalTipsCents: 0,
    };

    (allInvoices || []).forEach((inv) => {
      stats.totalAmountCents += inv.total_cents || 0;
      stats.totalTipsCents += inv.tip_cents || 0;

      switch (inv.status) {
        case "DRAFT":
          stats.draft.count++;
          stats.draft.amountCents += inv.total_cents || 0;
          break;
        case "OPEN":
          stats.open.count++;
          stats.open.amountCents += inv.total_cents || 0;
          break;
        case "OVERDUE":
          stats.overdue.count++;
          stats.overdue.amountCents += inv.total_cents || 0;
          break;
        case "PAID":
          stats.paid.count++;
          stats.paid.amountCents += inv.total_cents || 0;
          break;
        case "UNCOLLECTIBLE":
          stats.failed.count++;
          stats.failed.amountCents += inv.total_cents || 0;
          break;
      }
    });

    // Format invoices for response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formattedInvoices: RecurringInvoice[] = (invoices || []).map((inv: any) => {
      // Build client name
      const clientName = inv.client?.company_name
        ? inv.client.company_name
        : [inv.client?.first_name, inv.client?.last_name].filter(Boolean).join(" ");

      // Build address from subscription location
      const loc = inv.subscription?.location;
      const address = loc
        ? `${loc.address_line1 || ""}${loc.address_line2 ? " " + loc.address_line2 : ""}, ${loc.city || ""}, ${loc.state || ""} ${loc.zip_code || ""}`.trim()
        : "";

      // Get billing option/interval from invoice or subscription
      const billingOpt = inv.billing_option || inv.subscription?.billing_option || "PREPAID_FIXED";
      const billingInt = inv.billing_interval || inv.subscription?.billing_interval || "MONTHLY";

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        status: inv.status as InvoiceStatus,
        createdAt: inv.created_at,
        client: {
          id: inv.client?.id || "",
          name: clientName || "Unknown",
          type: (inv.client?.client_type || "RESIDENTIAL") as "RESIDENTIAL" | "COMMERCIAL",
          address,
          email: inv.client?.email || null,
        },
        paymentMethod: inv.payment_method as PaymentMethod | null,
        billingOption: billingOpt as BillingOption,
        billingInterval: billingInt as BillingInterval,
        totalCents: inv.total_cents || 0,
        tipCents: inv.tip_cents || 0,
        remainingCents: inv.amount_due_cents || 0,
        paidCents: inv.amount_paid_cents || 0,
        subscription: {
          id: inv.subscription?.id || "",
          planName: inv.subscription?.plan?.name || null,
          frequency: inv.subscription?.frequency || "MONTHLY",
        },
        items: (inv.invoice_items || []).map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          totalCents: item.total_cents,
        })),
      };
    });

    // Apply search filter (client-side for flexibility)
    if (search) {
      const searchLower = search.toLowerCase();
      formattedInvoices = formattedInvoices.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(searchLower) ||
          inv.client.name?.toLowerCase().includes(searchLower)
      );
    }

    // Apply client type filter (client-side since it's a joined field)
    if (clientType) {
      formattedInvoices = formattedInvoices.filter(
        (inv) => inv.client.type === clientType
      );
    }

    return NextResponse.json({
      invoices: formattedInvoices,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in recurring invoices API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/recurring-invoices
 * Bulk actions: finalize, email, or update invoices
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "invoices:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { action, invoiceIds } = body;

    if (!action || !invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "Action and invoice IDs are required" },
        { status: 400 }
      );
    }

    // Verify all invoices belong to the org
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("org_id", auth.user.orgId)
      .in("id", invoiceIds);

    if (!existingInvoices || existingInvoices.length !== invoiceIds.length) {
      return NextResponse.json(
        { error: "Some invoices not found or access denied" },
        { status: 404 }
      );
    }

    switch (action) {
      case "finalize": {
        // Only finalize DRAFT invoices
        const draftIds = existingInvoices
          .filter((inv) => inv.status === "DRAFT")
          .map((inv) => inv.id);

        if (draftIds.length === 0) {
          return NextResponse.json(
            { error: "No draft invoices to finalize" },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabase
          .from("invoices")
          .update({ status: "OPEN", updated_at: new Date().toISOString() })
          .in("id", draftIds);

        if (updateError) {
          throw updateError;
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: auth.user.orgId,
          user_id: auth.user.id,
          action: "INVOICES_FINALIZED",
          entity_type: "INVOICE",
          details: { invoiceIds: draftIds, count: draftIds.length },
        });

        return NextResponse.json({
          success: true,
          message: `${draftIds.length} invoice(s) finalized`,
        });
      }

      case "email": {
        // TODO: Implement email sending via notification system
        // For now, just log the action
        await supabase.from("activity_logs").insert({
          org_id: auth.user.orgId,
          user_id: auth.user.id,
          action: "INVOICES_EMAILED",
          entity_type: "INVOICE",
          details: { invoiceIds, count: invoiceIds.length },
        });

        return NextResponse.json({
          success: true,
          message: `${invoiceIds.length} invoice(s) queued for email`,
        });
      }

      case "delete": {
        // Only delete DRAFT invoices
        const draftIds = existingInvoices
          .filter((inv) => inv.status === "DRAFT")
          .map((inv) => inv.id);

        if (draftIds.length === 0) {
          return NextResponse.json(
            { error: "No draft invoices to delete" },
            { status: 400 }
          );
        }

        // Delete invoice items first
        await supabase
          .from("invoice_items")
          .delete()
          .in("invoice_id", draftIds);

        // Delete invoices
        const { error: deleteError } = await supabase
          .from("invoices")
          .delete()
          .in("id", draftIds);

        if (deleteError) {
          throw deleteError;
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          org_id: auth.user.orgId,
          user_id: auth.user.id,
          action: "INVOICES_DELETED",
          entity_type: "INVOICE",
          details: { invoiceIds: draftIds, count: draftIds.length },
        });

        return NextResponse.json({
          success: true,
          message: `${draftIds.length} invoice(s) deleted`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in bulk action:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/recurring-invoices
 * Void a specific invoice
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

    if (existing.status === "VOID") {
      return NextResponse.json(
        { error: "Invoice is already voided" },
        { status: 400 }
      );
    }

    // Void the invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "VOID",
        voided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
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
      { error: "Failed to void invoice" },
      { status: 500 }
    );
  }
}
