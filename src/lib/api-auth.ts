/**
 * API Route Authentication Helpers
 *
 * Provides authentication and permission checking for API routes.
 * Uses Supabase Auth with RBAC permission checks.
 * Supports both Bearer token (for PWAs) and cookie-based (for SSR) authentication.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { UserRole } from "@/lib/supabase/types";

export interface ApiUser {
  id: string;
  email: string;
  orgId: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Get Supabase client with service role for database operations
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

/**
 * Get Supabase client that reads auth from cookies
 */
async function getSupabaseWithCookies() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignored in Server Components / API routes
        }
      },
    },
  });
}

/**
 * Extract and verify the bearer token from the Authorization header
 */
async function verifyToken(authHeader: string | null): Promise<ApiUser | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase();

  // Verify the token and get the user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  // Get user profile from database
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
  };
}

/**
 * Verify authentication via cookies (for SSR/browser requests)
 */
async function verifyCookieAuth(): Promise<ApiUser | null> {
  try {
    const supabase = await getSupabaseWithCookies();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user profile from database using service role
    const serviceSupabase = getSupabase();
    const { data: profile } = await serviceSupabase
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
    };
  } catch {
    return null;
  }
}

export interface AuthResult {
  user: ApiUser | null;
  error: string | null;
  status: number;
}

/**
 * Authenticate an API request
 * Tries Bearer token first, then falls back to cookie-based auth
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  // Try Bearer token authentication first
  let user = await verifyToken(authHeader);

  // If no Bearer token, try cookie-based authentication
  if (!user) {
    user = await verifyCookieAuth();
  }

  if (!user) {
    return {
      user: null,
      error: "Unauthorized",
      status: 401,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}

/**
 * Authenticate and check permission for an API request
 */
export async function authenticateWithPermission(
  request: Request,
  permission: Permission
): Promise<AuthResult> {
  const authResult = await authenticateRequest(request);

  if (!authResult.user) {
    return authResult;
  }

  if (!hasPermission(authResult.user.role, permission)) {
    return {
      user: null,
      error: "Forbidden: Insufficient permissions",
      status: 403,
    };
  }

  return authResult;
}

/**
 * Authenticate and check any of the specified permissions
 */
export async function authenticateWithAnyPermission(
  request: Request,
  permissions: Permission[]
): Promise<AuthResult> {
  const authResult = await authenticateRequest(request);

  if (!authResult.user) {
    return authResult;
  }

  const hasAny = permissions.some((p) =>
    hasPermission(authResult.user!.role, p)
  );

  if (!hasAny) {
    return {
      user: null,
      error: "Forbidden: Insufficient permissions",
      status: 403,
    };
  }

  return authResult;
}

/**
 * Create a JSON error response
 */
export function errorResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
