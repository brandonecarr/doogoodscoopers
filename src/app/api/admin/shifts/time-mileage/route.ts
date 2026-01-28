/**
 * Time & Mileage Report API
 *
 * Aggregates shift data by staff member for reporting.
 * Returns total time worked and mileage (personal vs company) per user.
 *
 * GET /api/admin/shifts/time-mileage - Get aggregated time & mileage report
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface ShiftRecord {
  id: string;
  user_id: string;
  clock_in: string | null;
  clock_out: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  vehicle_type: string | null;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeShift(shift: any): ShiftRecord {
  return {
    id: shift.id,
    user_id: shift.user_id,
    clock_in: shift.clock_in,
    clock_out: shift.clock_out,
    start_odometer: shift.start_odometer,
    end_odometer: shift.end_odometer,
    vehicle_type: shift.vehicle_type,
    user: Array.isArray(shift.user) ? shift.user[0] || null : shift.user || null,
  };
}

interface StaffTimeMileage {
  userId: string;
  name: string;
  totalTimeMinutes: number;
  totalTimeFormatted: string;
  personalMileage: number;
  companyMileage: number;
  totalMileage: number;
  hasIncompleteShifts: boolean;
}

/**
 * GET /api/admin/shifts/time-mileage
 * Get aggregated time & mileage by staff
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "shifts:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  // Filters
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const userId = searchParams.get("userId");

  // Build query
  let query = supabase
    .from("shifts")
    .select(`
      id,
      user_id,
      clock_in,
      clock_out,
      start_odometer,
      end_odometer,
      vehicle_type,
      user:user_id (
        id,
        first_name,
        last_name
      )
    `)
    .eq("org_id", auth.user.orgId);

  // Apply date filters
  if (startDate) {
    query = query.gte("shift_date", startDate);
  }
  if (endDate) {
    query = query.lte("shift_date", endDate);
  }

  // Filter by specific user if provided
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: shifts, error } = await query;

  if (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }

  // Get list of staff members for the dropdown
  const { data: staffList } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("org_id", auth.user.orgId)
    .order("first_name");

  // Aggregate by user
  const userMap = new Map<string, StaffTimeMileage>();

  for (const rawShift of shifts || []) {
    const shift = normalizeShift(rawShift);
    const uid = shift.user_id;
    if (!uid) continue;

    if (!userMap.has(uid)) {
      const userName = shift.user
        ? `${shift.user.first_name || ""} ${shift.user.last_name || ""}`.trim() || "Unknown"
        : "Unknown";

      userMap.set(uid, {
        userId: uid,
        name: userName,
        totalTimeMinutes: 0,
        totalTimeFormatted: "0:00",
        personalMileage: 0,
        companyMileage: 0,
        totalMileage: 0,
        hasIncompleteShifts: false,
      });
    }

    const record = userMap.get(uid)!;

    // Calculate time if both clock_in and clock_out exist
    if (shift.clock_in && shift.clock_out) {
      const start = new Date(shift.clock_in).getTime();
      const end = new Date(shift.clock_out).getTime();
      const diffMinutes = Math.floor((end - start) / (1000 * 60));
      if (diffMinutes > 0) {
        record.totalTimeMinutes += diffMinutes;
      }
    } else if (shift.clock_in && !shift.clock_out) {
      // Has incomplete shift (clocked in but not out)
      record.hasIncompleteShifts = true;
    }

    // Calculate mileage if both odometer readings exist
    if (shift.start_odometer !== null && shift.end_odometer !== null) {
      const distance = shift.end_odometer - shift.start_odometer;
      if (distance > 0) {
        // Check vehicle type - assume "PERSONAL" for personal, anything else is company
        const isPersonal = shift.vehicle_type?.toUpperCase() === "PERSONAL";
        if (isPersonal) {
          record.personalMileage += distance;
        } else {
          record.companyMileage += distance;
        }
        record.totalMileage += distance;
      }
    }
  }

  // Format time and convert to array
  const staffReport: StaffTimeMileage[] = Array.from(userMap.values()).map((record) => {
    const hours = Math.floor(record.totalTimeMinutes / 60);
    const minutes = record.totalTimeMinutes % 60;
    record.totalTimeFormatted = `${hours}:${minutes.toString().padStart(2, "0")}`;
    return record;
  });

  // Sort by name
  staffReport.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    report: staffReport,
    staff: (staffList || []).map((s) => ({
      id: s.id,
      name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unknown",
    })),
    filters: {
      startDate,
      endDate,
      userId,
    },
  });
}
