/**
 * Staff Management API
 *
 * CRUD operations for staff members (non-client users).
 * Requires staff:read for GET, staff:write for management, staff:delete for deletion.
 *
 * GET /api/admin/staff - List all staff members
 * POST /api/admin/staff - Create new staff member
 * PUT /api/admin/staff - Update staff member
 * DELETE /api/admin/staff - Deactivate staff member
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import type { UserRole } from "@/lib/supabase/types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const STAFF_ROLES: UserRole[] = [
  "OWNER",
  "MANAGER",
  "OFFICE",
  "CREW_LEAD",
  "FIELD_TECH",
  "ACCOUNTANT",
];

interface StaffProfile {
  employee_id: string | null;
  hire_date: string | null;
  hourly_rate_cents: number | null;
  vehicle_type: string | null;
  license_plate: string | null;
  emergency_contact: Record<string, string> | null;
  certifications: string[];
  notes: string | null;
}

/**
 * GET /api/admin/staff
 * List all staff members with their profiles
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "staff:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);

  const role = searchParams.get("role");
  const status = searchParams.get("status"); // active, inactive, all
  const search = searchParams.get("search");

  let query = supabase
    .from("users")
    .select(
      `
      id,
      email,
      role,
      first_name,
      last_name,
      phone,
      avatar_url,
      is_active,
      last_login_at,
      created_at,
      updated_at,
      staff_profile:staff_profiles!left (
        id,
        employee_id,
        hire_date,
        hourly_rate_cents,
        vehicle_type,
        license_plate,
        emergency_contact,
        certifications,
        notes
      )
    `
    )
    .eq("org_id", auth.user.orgId)
    .in("role", STAFF_ROLES)
    .order("first_name", { ascending: true });

  // Filter by role
  if (role && STAFF_ROLES.includes(role as UserRole)) {
    query = query.eq("role", role);
  }

  // Filter by status
  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  // Search by name or email
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: staff, error } = await query;

  if (error) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    );
  }

  // Get shift stats for today
  const today = new Date().toISOString().split("T")[0];
  const { data: todayShifts } = await supabase
    .from("shifts")
    .select("user_id, status")
    .eq("org_id", auth.user.orgId)
    .eq("shift_date", today)
    .in("status", ["CLOCKED_IN", "ON_BREAK"]);

  const activeShiftUsers = new Set((todayShifts || []).map((s) => s.user_id));

  // Normalize staff_profile from array to object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedStaff = (staff || []).map((s: any) => ({
    ...s,
    staff_profile: Array.isArray(s.staff_profile)
      ? s.staff_profile[0] || null
      : s.staff_profile,
    is_clocked_in: activeShiftUsers.has(s.id),
  }));

  return NextResponse.json({
    staff: normalizedStaff,
    total: normalizedStaff.length,
    active: normalizedStaff.filter((s: { is_active: boolean }) => s.is_active).length,
    clocked_in: activeShiftUsers.size,
  });
}

/**
 * POST /api/admin/staff
 * Create a new staff member
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "staff:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      email,
      role,
      firstName,
      lastName,
      phone,
      password,
      profile,
    } = body;

    // Validate required fields
    if (!email || !role || !firstName) {
      return NextResponse.json(
        { error: "Email, role, and first name are required" },
        { status: 400 }
      );
    }

    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Create auth user in Supabase Auth
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password || generateTempPassword(),
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create user record
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        id: authUser.user.id,
        org_id: auth.user.orgId,
        email: email.toLowerCase(),
        role,
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || null,
        is_active: true,
      })
      .select()
      .single();

    if (userError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error("Error creating user record:", userError);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Create staff profile if provided
    if (profile) {
      const emergencyContact: Record<string, string> = {};
      if (profile.emergencyContactName) emergencyContact.name = profile.emergencyContactName;
      if (profile.emergencyContactPhone) emergencyContact.phone = profile.emergencyContactPhone;

      await supabase.from("staff_profiles").insert({
        org_id: auth.user.orgId,
        user_id: newUser.id,
        employee_id: profile.employeeId || null,
        hire_date: profile.hireDate || null,
        hourly_rate_cents: profile.hourlyRateCents || null,
        vehicle_type: profile.vehicleType || null,
        license_plate: profile.licensePlate || null,
        emergency_contact: Object.keys(emergencyContact).length > 0 ? emergencyContact : {},
        certifications: profile.certifications || [],
        notes: profile.notes || null,
      });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "STAFF_CREATED",
      entity_type: "USER",
      entity_id: newUser.id,
      details: { email, role, firstName, lastName },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating staff:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/staff
 * Update a staff member
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "staff:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, email, role, firstName, lastName, phone, isActive, profile } =
      body;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify user belongs to org
    const { data: existing } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent changing own role or deactivating self
    if (id === auth.user.id) {
      if (role !== undefined && role !== existing.role) {
        return NextResponse.json(
          { error: "Cannot change your own role" },
          { status: 400 }
        );
      }
      if (isActive === false) {
        return NextResponse.json(
          { error: "Cannot deactivate your own account" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined && STAFF_ROLES.includes(role)) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive;

    // Update email if changed (also update in auth)
    if (email !== undefined && email.toLowerCase() !== existing.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        id,
        { email: email.toLowerCase() }
      );
      if (authError) {
        console.error("Error updating auth email:", authError);
        return NextResponse.json(
          { error: "Failed to update email" },
          { status: 500 }
        );
      }
      updates.email = email.toLowerCase();
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    // Update or create staff profile
    if (profile) {
      const profileData: Partial<StaffProfile> = {};
      if (profile.employeeId !== undefined)
        profileData.employee_id = profile.employeeId;
      if (profile.hireDate !== undefined)
        profileData.hire_date = profile.hireDate;
      if (profile.hourlyRateCents !== undefined)
        profileData.hourly_rate_cents = profile.hourlyRateCents;
      if (profile.vehicleType !== undefined)
        profileData.vehicle_type = profile.vehicleType;
      if (profile.licensePlate !== undefined)
        profileData.license_plate = profile.licensePlate;
      if (profile.certifications !== undefined)
        profileData.certifications = profile.certifications;
      if (profile.notes !== undefined) profileData.notes = profile.notes;

      // Handle emergency contact as jsonb
      if (profile.emergencyContactName !== undefined || profile.emergencyContactPhone !== undefined) {
        const emergencyContact: Record<string, string> = {};
        if (profile.emergencyContactName) emergencyContact.name = profile.emergencyContactName;
        if (profile.emergencyContactPhone) emergencyContact.phone = profile.emergencyContactPhone;
        profileData.emergency_contact = emergencyContact;
      }

      const { data: existingProfile } = await supabase
        .from("staff_profiles")
        .select("id, emergency_contact")
        .eq("user_id", id)
        .single();

      if (existingProfile) {
        // Merge emergency contact if updating partially
        if (profileData.emergency_contact && existingProfile.emergency_contact) {
          profileData.emergency_contact = {
            ...existingProfile.emergency_contact,
            ...profileData.emergency_contact,
          };
        }
        await supabase
          .from("staff_profiles")
          .update(profileData)
          .eq("user_id", id);
      } else {
        await supabase.from("staff_profiles").insert({
          org_id: auth.user.orgId,
          user_id: id,
          emergency_contact: profileData.emergency_contact || {},
          certifications: profileData.certifications || [],
          ...profileData,
        });
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "STAFF_UPDATED",
      entity_type: "USER",
      entity_id: id,
      details: { updates },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating staff:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/staff
 * Deactivate a staff member (soft delete)
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "staff:delete");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify user belongs to org
    const { data: existing } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting self
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Soft delete - just deactivate
    const { error: updateError } = await supabase
      .from("users")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Error deactivating user:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate user" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      org_id: auth.user.orgId,
      user_id: auth.user.id,
      action: "STAFF_DEACTIVATED",
      entity_type: "USER",
      entity_id: id,
      details: { email: existing.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating staff:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

function generateTempPassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
