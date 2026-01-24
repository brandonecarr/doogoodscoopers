import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/supabase/types";
import {
  hasPermission,
  hasAnyPermission,
  canAccessOfficePortal,
  canAccessFieldPortal,
  canAccessClientPortal,
  type Permission,
} from "@/lib/rbac";

export interface AuthUser {
  id: string;
  email: string;
  orgId: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

// Get the current authenticated user with profile data
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role, first_name, last_name, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    orgId: profile.org_id,
    role: profile.role as UserRole,
    firstName: profile.first_name,
    lastName: profile.last_name,
    isActive: profile.is_active,
  };
}

// Require authentication - redirects if not authenticated
export async function requireAuth(redirectTo = "/login"): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

// Require a specific role
export async function requireRole(
  requiredRole: UserRole,
  redirectTo = "/login"
): Promise<AuthUser> {
  const user = await requireAuth(redirectTo);

  if (user.role !== requiredRole) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require any of the specified roles
export async function requireAnyRole(
  roles: UserRole[],
  redirectTo = "/login"
): Promise<AuthUser> {
  const user = await requireAuth(redirectTo);

  if (!roles.includes(user.role)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require a specific permission
export async function requirePermission(
  permission: Permission,
  redirectTo = "/login"
): Promise<AuthUser> {
  const user = await requireAuth(redirectTo);

  if (!hasPermission(user.role, permission)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require any of the specified permissions
export async function requireAnyPermission(
  permissions: Permission[],
  redirectTo = "/login"
): Promise<AuthUser> {
  const user = await requireAuth(redirectTo);

  if (!hasAnyPermission(user.role, permissions)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require office portal access
export async function requireOfficeAccess(): Promise<AuthUser> {
  const user = await requireAuth("/login");

  if (!canAccessOfficePortal(user.role)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require field portal access
export async function requireFieldAccess(): Promise<AuthUser> {
  const user = await requireAuth("/login");

  if (!canAccessFieldPortal(user.role)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Require client portal access
export async function requireClientAccess(): Promise<AuthUser> {
  const user = await requireAuth("/login");

  if (!canAccessClientPortal(user.role)) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user;
}

// Get the default redirect URL for a role
export function getDefaultRedirectForRole(role: UserRole): string {
  switch (role) {
    case "OWNER":
    case "MANAGER":
    case "OFFICE":
    case "ACCOUNTANT":
      return "/app/office";
    case "CREW_LEAD":
    case "FIELD_TECH":
      return "/app/field";
    case "CLIENT":
      return "/app/client";
    default:
      return "/";
  }
}

// Sign out
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Get the user's role to determine redirect
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Account is not active. Please contact support." };
  }

  return {
    user: data.user,
    redirectTo: getDefaultRedirectForRole(profile.role as UserRole),
  };
}

// Sign in with magic link
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?redirect=${redirectTo}`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// Sign up a new user (for client registration)
export async function signUp(
  email: string,
  password: string,
  metadata: {
    firstName: string;
    lastName?: string;
    phone?: string;
  }
) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: metadata.firstName,
        last_name: metadata.lastName,
        phone: metadata.phone,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { user: data.user };
}

// Update password
export async function updatePassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// Request password reset
export async function resetPasswordRequest(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
