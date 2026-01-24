import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the user's role from our users table
  let userRole: string | null = null;
  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("role, org_id, is_active")
      .eq("id", user.id)
      .single();

    if (userData?.is_active) {
      userRole = userData.role;
    }
  }

  const pathname = request.nextUrl.pathname;

  // Define protected route patterns
  const protectedPatterns = {
    office: /^\/app\/office/,
    field: /^\/app\/field/,
    client: /^\/app\/client/,
    admin: /^\/admin(?!\/login)/,
  };

  // Define role-to-route access mapping
  const roleAccess: Record<string, RegExp[]> = {
    OWNER: [protectedPatterns.office, protectedPatterns.field, protectedPatterns.client, protectedPatterns.admin],
    MANAGER: [protectedPatterns.office, protectedPatterns.field, protectedPatterns.admin],
    OFFICE: [protectedPatterns.office, protectedPatterns.admin],
    CREW_LEAD: [protectedPatterns.office, protectedPatterns.field],
    FIELD_TECH: [protectedPatterns.field],
    ACCOUNTANT: [protectedPatterns.office],
    CLIENT: [protectedPatterns.client],
  };

  // Check if route requires authentication
  const isProtectedRoute = Object.values(protectedPatterns).some((pattern) =>
    pattern.test(pathname)
  );

  if (isProtectedRoute) {
    // Not logged in - redirect to login
    if (!user || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has access to this route
    const allowedPatterns = roleAccess[userRole] || [];
    const hasAccess = allowedPatterns.some((pattern) => pattern.test(pathname));

    if (!hasAccess) {
      // Redirect to appropriate home based on role
      const roleHomeMap: Record<string, string> = {
        OWNER: "/app/office",
        MANAGER: "/app/office",
        OFFICE: "/app/office",
        CREW_LEAD: "/app/field",
        FIELD_TECH: "/app/field",
        ACCOUNTANT: "/app/office",
        CLIENT: "/app/client",
      };
      const homeUrl = new URL(roleHomeMap[userRole] || "/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Redirect logged-in users away from login page
  if (user && userRole && pathname === "/login") {
    const roleHomeMap: Record<string, string> = {
      OWNER: "/app/office",
      MANAGER: "/app/office",
      OFFICE: "/app/office",
      CREW_LEAD: "/app/field",
      FIELD_TECH: "/app/field",
      ACCOUNTANT: "/app/office",
      CLIENT: "/app/client",
    };
    const homeUrl = new URL(roleHomeMap[userRole] || "/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
