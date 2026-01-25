/**
 * Notifications API
 *
 * List notifications, get history, and cancel pending notifications.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE"];

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const clientId = searchParams.get("clientId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("notifications")
      .select(
        `
        id,
        channel,
        recipient,
        subject,
        body,
        status,
        scheduled_for,
        sent_at,
        provider_id,
        error_message,
        created_at,
        client:client_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        job:job_id (
          id,
          scheduled_date,
          status
        ),
        template:template_id (
          type,
          name
        )
      `,
        { count: "exact" }
      )
      .eq("org_id", auth.user.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (channel) {
      query = query.eq("channel", channel);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: notifications, count, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from("notifications")
      .select("status")
      .eq("org_id", auth.user.orgId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const statusCounts = {
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    for (const s of stats || []) {
      const key = s.status.toLowerCase() as keyof typeof statusCounts;
      if (key in statusCounts) {
        statusCounts[key]++;
      }
    }

    return NextResponse.json({
      notifications: (notifications || []).map((n) => ({
        id: n.id,
        channel: n.channel,
        recipient: n.recipient,
        subject: n.subject,
        body: n.body,
        status: n.status,
        scheduledFor: n.scheduled_for,
        sentAt: n.sent_at,
        providerId: n.provider_id,
        errorMessage: n.error_message,
        createdAt: n.created_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: n.client as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (n.client as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: `${(n.client as any).first_name} ${(n.client as any).last_name}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (n.client as any).email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              phone: (n.client as any).phone,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        job: n.job as any
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: (n.job as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              date: (n.job as any).scheduled_date,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              status: (n.job as any).status,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        templateType: (n.template as any)?.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        templateName: (n.template as any)?.name,
      })),
      stats: statusCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const notificationId = searchParams.get("id");

  if (!notificationId) {
    return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
  }

  try {
    // Verify notification belongs to org and is pending
    const { data: notification } = await supabase
      .from("notifications")
      .select("id, status")
      .eq("id", notificationId)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notification.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending notifications can be cancelled" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({
        status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (updateError) {
      console.error("Error cancelling notification:", updateError);
      return NextResponse.json({ error: "Failed to cancel notification" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Notification cancelled" });
  } catch (error) {
    console.error("Error cancelling notification:", error);
    return NextResponse.json({ error: "Failed to cancel notification" }, { status: 500 });
  }
}
