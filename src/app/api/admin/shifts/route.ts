/**
 * Shifts Management API
 *
 * CRUD operations for shift management and clock in/out.
 * Requires shifts:read for GET, shifts:write for management, shifts:clock for clock in/out.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateWithAnyPermission,
  errorResponse,
} from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * GET /api/admin/shifts
 * List shifts with optional filtering
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithAnyPermission(request, ["shifts:read", "shifts:clock"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Filters
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const myShifts = searchParams.get("myShifts") === "true";

  let query = supabase
    .from("shifts")
    .select(`
      *,
      user:user_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      route:route_id (
        id,
        name,
        status
      ),
      breaks:shift_breaks (
        id,
        break_start,
        break_end,
        break_type
      )
    `)
    .eq("org_id", auth.user.orgId)
    .order("shift_date", { ascending: false })
    .order("clock_in", { ascending: false });

  // Apply filters
  if (date) {
    query = query.eq("shift_date", date);
  } else if (startDate && endDate) {
    query = query.gte("shift_date", startDate).lte("shift_date", endDate);
  } else if (startDate) {
    query = query.gte("shift_date", startDate);
  } else if (endDate) {
    query = query.lte("shift_date", endDate);
  }

  if (myShifts) {
    query = query.eq("user_id", auth.user.id);
  } else if (userId) {
    query = query.eq("user_id", userId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: shifts, error } = await query;

  if (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }

  return NextResponse.json({ shifts });
}

/**
 * POST /api/admin/shifts
 * Create a shift or clock in
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithAnyPermission(request, ["shifts:write", "shifts:clock"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const supabase = getSupabase();

    // Determine if this is a clock-in or creating a scheduled shift
    const isClockIn = body.action === "clock_in";

    if (isClockIn) {
      // Clock in - create shift for current user
      const today = new Date().toISOString().split("T")[0];

      // Check if already clocked in today
      const { data: existingShift } = await supabase
        .from("shifts")
        .select("id, status")
        .eq("org_id", auth.user.orgId)
        .eq("user_id", auth.user.id)
        .eq("shift_date", today)
        .in("status", ["CLOCKED_IN", "ON_BREAK"])
        .single();

      if (existingShift) {
        return NextResponse.json(
          { error: "Already clocked in for today" },
          { status: 400 }
        );
      }

      // Create shift with clock in
      const { data: shift, error } = await supabase
        .from("shifts")
        .insert({
          org_id: auth.user.orgId,
          user_id: auth.user.id,
          route_id: body.route_id || null,
          shift_date: today,
          clock_in: new Date().toISOString(),
          start_odometer: body.start_odometer || null,
          vehicle_type: body.vehicle_type || null,
          status: "CLOCKED_IN",
          notes: body.notes || null,
        })
        .select(`
          *,
          user:user_id (
            id,
            first_name,
            last_name
          )
        `)
        .single();

      if (error) {
        console.error("Error clocking in:", error);
        return NextResponse.json(
          { error: "Failed to clock in" },
          { status: 500 }
        );
      }

      return NextResponse.json({ shift, action: "clock_in" }, { status: 201 });
    } else {
      // Create a scheduled shift
      if (!body.user_id || !body.shift_date) {
        return NextResponse.json(
          { error: "user_id and shift_date are required" },
          { status: 400 }
        );
      }

      const { data: shift, error } = await supabase
        .from("shifts")
        .insert({
          org_id: auth.user.orgId,
          user_id: body.user_id,
          route_id: body.route_id || null,
          shift_date: body.shift_date,
          status: "SCHEDULED",
          notes: body.notes || null,
        })
        .select(`
          *,
          user:user_id (
            id,
            first_name,
            last_name
          )
        `)
        .single();

      if (error) {
        console.error("Error creating shift:", error);
        return NextResponse.json(
          { error: "Failed to create shift" },
          { status: 500 }
        );
      }

      return NextResponse.json({ shift }, { status: 201 });
    }
  } catch (error) {
    console.error("Error in shift creation:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/shifts
 * Update a shift, clock out, or manage breaks
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithAnyPermission(request, ["shifts:write", "shifts:clock"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const body = await request.json();
    const supabase = getSupabase();

    // Handle special actions
    const action = body.action;

    if (action === "clock_out") {
      // Find the active shift
      const today = new Date().toISOString().split("T")[0];
      const { data: activeShift } = await supabase
        .from("shifts")
        .select("id, clock_in")
        .eq("org_id", auth.user.orgId)
        .eq("user_id", auth.user.id)
        .eq("shift_date", today)
        .in("status", ["CLOCKED_IN", "ON_BREAK"])
        .single();

      if (!activeShift) {
        return NextResponse.json(
          { error: "No active shift found" },
          { status: 404 }
        );
      }

      // End any active break
      await supabase
        .from("shift_breaks")
        .update({ break_end: new Date().toISOString() })
        .eq("shift_id", activeShift.id)
        .is("break_end", null);

      // Clock out
      const { data: shift, error } = await supabase
        .from("shifts")
        .update({
          clock_out: new Date().toISOString(),
          end_odometer: body.end_odometer || null,
          status: "CLOCKED_OUT",
          notes: body.notes || null,
        })
        .eq("id", activeShift.id)
        .select()
        .single();

      if (error) {
        console.error("Error clocking out:", error);
        return NextResponse.json(
          { error: "Failed to clock out" },
          { status: 500 }
        );
      }

      return NextResponse.json({ shift, action: "clock_out" });
    }

    if (action === "start_break") {
      // Find the active shift
      const today = new Date().toISOString().split("T")[0];
      const { data: activeShift } = await supabase
        .from("shifts")
        .select("id")
        .eq("org_id", auth.user.orgId)
        .eq("user_id", auth.user.id)
        .eq("shift_date", today)
        .eq("status", "CLOCKED_IN")
        .single();

      if (!activeShift) {
        return NextResponse.json(
          { error: "No active shift found or already on break" },
          { status: 404 }
        );
      }

      // Create break
      const { error: breakError } = await supabase.from("shift_breaks").insert({
        org_id: auth.user.orgId,
        shift_id: activeShift.id,
        break_start: new Date().toISOString(),
        break_type: body.break_type || "REGULAR",
      });

      if (breakError) {
        console.error("Error starting break:", breakError);
        return NextResponse.json(
          { error: "Failed to start break" },
          { status: 500 }
        );
      }

      // Update shift status
      await supabase
        .from("shifts")
        .update({ status: "ON_BREAK" })
        .eq("id", activeShift.id);

      return NextResponse.json({ success: true, action: "start_break" });
    }

    if (action === "end_break") {
      // Find the active shift
      const today = new Date().toISOString().split("T")[0];
      const { data: activeShift } = await supabase
        .from("shifts")
        .select("id")
        .eq("org_id", auth.user.orgId)
        .eq("user_id", auth.user.id)
        .eq("shift_date", today)
        .eq("status", "ON_BREAK")
        .single();

      if (!activeShift) {
        return NextResponse.json(
          { error: "Not currently on break" },
          { status: 404 }
        );
      }

      // End the break
      await supabase
        .from("shift_breaks")
        .update({ break_end: new Date().toISOString() })
        .eq("shift_id", activeShift.id)
        .is("break_end", null);

      // Update shift status
      await supabase
        .from("shifts")
        .update({ status: "CLOCKED_IN" })
        .eq("id", activeShift.id);

      return NextResponse.json({ success: true, action: "end_break" });
    }

    // Standard shift update
    if (!body.id) {
      return NextResponse.json(
        { error: "Shift ID is required" },
        { status: 400 }
      );
    }

    // Verify shift belongs to org
    const { data: existing } = await supabase
      .from("shifts")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.route_id !== undefined) updates.route_id = body.route_id;
    if (body.shift_date !== undefined) updates.shift_date = body.shift_date;
    if (body.clock_in !== undefined) updates.clock_in = body.clock_in;
    if (body.clock_out !== undefined) updates.clock_out = body.clock_out;
    if (body.start_odometer !== undefined) updates.start_odometer = body.start_odometer;
    if (body.end_odometer !== undefined) updates.end_odometer = body.end_odometer;
    if (body.vehicle_type !== undefined) updates.vehicle_type = body.vehicle_type;
    if (body.status !== undefined) {
      const validStatuses = ["SCHEDULED", "CLOCKED_IN", "ON_BREAK", "CLOCKED_OUT"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (body.notes !== undefined) updates.notes = body.notes;

    const { data: shift, error } = await supabase
      .from("shifts")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating shift:", error);
      return NextResponse.json(
        { error: "Failed to update shift" },
        { status: 500 }
      );
    }

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Error updating shift:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/shifts
 * Delete a shift
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithAnyPermission(request, ["shifts:write"]);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Shift ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify shift belongs to org and is not active
    const { data: existing } = await supabase
      .from("shifts")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    if (["CLOCKED_IN", "ON_BREAK"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Cannot delete an active shift" },
        { status: 400 }
      );
    }

    // Delete breaks first
    await supabase.from("shift_breaks").delete().eq("shift_id", id);

    // Delete the shift
    const { error } = await supabase.from("shifts").delete().eq("id", id);

    if (error) {
      console.error("Error deleting shift:", error);
      return NextResponse.json(
        { error: "Failed to delete shift" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
