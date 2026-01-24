/**
 * Field Shift API
 *
 * Handles clock in/out and break management for field technicians.
 * GET - Get current shift status
 * POST - Clock in, clock out, or manage breaks
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

// Get Supabase client with service role
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

// Allowed roles for field shift management
const FIELD_ROLES = ["FIELD_TECH", "CREW_LEAD", "MANAGER", "OWNER"];

/**
 * GET /api/field/shift
 * Get current shift status for the authenticated user
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  // Get today's shift with breaks
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select(`
      id,
      status,
      shift_date,
      clock_in,
      clock_out,
      vehicle_type,
      start_odometer,
      end_odometer,
      notes,
      breaks:shift_breaks (
        id,
        break_start,
        break_end,
        break_type
      )
    `)
    .eq("user_id", auth.user.id)
    .eq("shift_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (shiftError && shiftError.code !== "PGRST116") {
    console.error("Error fetching shift:", shiftError);
    return NextResponse.json(
      { error: "Failed to fetch shift" },
      { status: 500 }
    );
  }

  // Get today's route assignment if exists
  let routeInfo = null;
  if (shift) {
    const { data: route } = await supabase
      .from("routes")
      .select(`
        id,
        name,
        status,
        stops:route_stops (
          id,
          job:job_id (
            status
          )
        )
      `)
      .eq("assigned_to", auth.user.id)
      .eq("route_date", today)
      .limit(1)
      .single();

    if (route) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stops = (route.stops || []) as any[];
      routeInfo = {
        id: route.id,
        name: route.name,
        status: route.status,
        totalStops: stops.length,
        completedStops: stops.filter((s) => s.job?.status === "COMPLETED").length,
      };
    }
  }

  return NextResponse.json({
    shift: shift
      ? {
          id: shift.id,
          status: shift.status,
          shiftDate: shift.shift_date,
          clockIn: shift.clock_in,
          clockOut: shift.clock_out,
          vehicleType: shift.vehicle_type,
          startOdometer: shift.start_odometer,
          endOdometer: shift.end_odometer,
          notes: shift.notes,
          breaks: (shift.breaks || []).map((b: {
            id: string;
            break_start: string;
            break_end: string | null;
            break_type: string;
          }) => ({
            id: b.id,
            start: b.break_start,
            end: b.break_end,
            type: b.break_type,
          })),
        }
      : null,
    route: routeInfo,
  });
}

/**
 * POST /api/field/shift
 * Clock in, clock out, or manage breaks
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!FIELD_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Not authorized for field operations" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Handle different actions
    switch (action) {
      case "clock_in": {
        // Check for existing active shift
        const { data: existingShift } = await supabase
          .from("shifts")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("shift_date", today)
          .in("status", ["CLOCKED_IN", "ON_BREAK"])
          .single();

        if (existingShift) {
          return NextResponse.json(
            { error: "Already clocked in today" },
            { status: 400 }
          );
        }

        // Validate required fields
        if (!body.vehicleType) {
          return NextResponse.json(
            { error: "Vehicle type is required for clock in" },
            { status: 400 }
          );
        }

        // Create new shift
        const { data: newShift, error: createError } = await supabase
          .from("shifts")
          .insert({
            org_id: auth.user.orgId,
            user_id: auth.user.id,
            shift_date: today,
            clock_in: now,
            status: "CLOCKED_IN",
            vehicle_type: body.vehicleType,
            start_odometer: body.startOdometer || null,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating shift:", createError);
          return NextResponse.json(
            { error: "Failed to clock in" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: "clock_in",
          shift: {
            id: newShift.id,
            status: newShift.status,
            clockIn: newShift.clock_in,
            vehicleType: newShift.vehicle_type,
            startOdometer: newShift.start_odometer,
          },
        });
      }

      case "clock_out": {
        // Get current active shift
        const { data: activeShift, error: shiftError } = await supabase
          .from("shifts")
          .select("id, status")
          .eq("user_id", auth.user.id)
          .eq("shift_date", today)
          .in("status", ["CLOCKED_IN", "ON_BREAK"])
          .single();

        if (shiftError || !activeShift) {
          return NextResponse.json(
            { error: "No active shift to clock out" },
            { status: 400 }
          );
        }

        // End any active break first
        if (activeShift.status === "ON_BREAK") {
          await supabase
            .from("shift_breaks")
            .update({ break_end: now })
            .eq("shift_id", activeShift.id)
            .is("break_end", null);
        }

        // Update shift
        const { data: updatedShift, error: updateError } = await supabase
          .from("shifts")
          .update({
            clock_out: now,
            status: "CLOCKED_OUT",
            end_odometer: body.endOdometer || null,
          })
          .eq("id", activeShift.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error clocking out:", updateError);
          return NextResponse.json(
            { error: "Failed to clock out" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: "clock_out",
          shift: {
            id: updatedShift.id,
            status: updatedShift.status,
            clockOut: updatedShift.clock_out,
            endOdometer: updatedShift.end_odometer,
          },
        });
      }

      case "start_break": {
        // Get current active shift
        const { data: activeShift, error: shiftError } = await supabase
          .from("shifts")
          .select("id, status")
          .eq("user_id", auth.user.id)
          .eq("shift_date", today)
          .eq("status", "CLOCKED_IN")
          .single();

        if (shiftError || !activeShift) {
          return NextResponse.json(
            { error: "Must be clocked in to start a break" },
            { status: 400 }
          );
        }

        // Create break record
        const { data: newBreak, error: breakError } = await supabase
          .from("shift_breaks")
          .insert({
            org_id: auth.user.orgId,
            shift_id: activeShift.id,
            break_start: now,
            break_type: body.breakType || "REGULAR",
          })
          .select()
          .single();

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

        return NextResponse.json({
          success: true,
          action: "start_break",
          break: {
            id: newBreak.id,
            start: newBreak.break_start,
            type: newBreak.break_type,
          },
        });
      }

      case "end_break": {
        // Get current shift on break
        const { data: activeShift, error: shiftError } = await supabase
          .from("shifts")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("shift_date", today)
          .eq("status", "ON_BREAK")
          .single();

        if (shiftError || !activeShift) {
          return NextResponse.json(
            { error: "Not currently on a break" },
            { status: 400 }
          );
        }

        // End the break
        const { data: endedBreak, error: breakError } = await supabase
          .from("shift_breaks")
          .update({ break_end: now })
          .eq("shift_id", activeShift.id)
          .is("break_end", null)
          .select()
          .single();

        if (breakError) {
          console.error("Error ending break:", breakError);
          return NextResponse.json(
            { error: "Failed to end break" },
            { status: 500 }
          );
        }

        // Update shift status
        await supabase
          .from("shifts")
          .update({ status: "CLOCKED_IN" })
          .eq("id", activeShift.id);

        return NextResponse.json({
          success: true,
          action: "end_break",
          break: {
            id: endedBreak.id,
            start: endedBreak.break_start,
            end: endedBreak.break_end,
            type: endedBreak.break_type,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing shift action:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
