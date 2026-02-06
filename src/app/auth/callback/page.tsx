"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/app/office",
  MANAGER: "/app/office",
  OFFICE: "/app/office",
  CREW_LEAD: "/app/field",
  FIELD_TECH: "/app/field",
  ACCOUNTANT: "/app/office",
  CLIENT: "/app/client",
};

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout>;

    async function redirectByRole(userId: string) {
      const redirect = searchParams.get("redirect");

      const { data: profile } = await supabase
        .from("users")
        .select("role, is_active")
        .eq("id", userId)
        .single<{ role: string; is_active: boolean }>();

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        router.push("/login?error=account_inactive");
        return;
      }

      const dest = redirect || ROLE_HOME[profile.role] || "/";
      router.push(dest);
      router.refresh();
    }

    async function processCallback() {
      // 1) PKCE flow: exchange auth code for session
      const code = searchParams.get("code");
      if (code) {
        const { data, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (codeErr || !data.user) {
          setError("Authentication failed. Redirecting to login...");
          timeoutId = setTimeout(() => router.push("/login?error=auth_failed"), 2000);
          return;
        }
        await redirectByRole(data.user.id);
        return;
      }

      // 2) Implicit flow: Supabase client auto-detects #access_token hash
      //    Check if session is already available
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await redirectByRole(session.user.id);
        return;
      }

      // 3) Session not ready yet — wait for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            subscription.unsubscribe();
            clearTimeout(timeoutId);
            await redirectByRole(session.user.id);
          }
        }
      );

      // Timeout: if nothing happens in 10s, redirect to login
      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        router.push("/login?error=auth_timeout");
      }, 10000);
    }

    processCallback();

    return () => clearTimeout(timeoutId);
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-navy-50 flex flex-col items-center justify-center gap-3">
        <p className="text-red-600 text-sm">{error}</p>
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-navy-50 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      <p className="text-navy-600 text-sm">Signing you in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-navy-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
