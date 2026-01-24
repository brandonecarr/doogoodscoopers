import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDefaultRedirectForRole } from "@/lib/auth-supabase";
import type { UserRole } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("redirect");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    if (data.user) {
      // Get the user's role to determine redirect
      const { data: profile } = await supabase
        .from("users")
        .select("role, is_active")
        .eq("id", data.user.id)
        .single();

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=account_inactive`);
      }

      // Redirect to the specified URL or role-based default
      const redirectTo = redirect || getDefaultRedirectForRole(profile.role as UserRole);
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // If no code, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
