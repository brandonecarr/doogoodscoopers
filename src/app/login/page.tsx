"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, ArrowRight, Dog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "password" | "magic-link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError("Login failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Get user role to determine redirect
      const { data: profile } = await supabase
        .from("users")
        .select("role, is_active")
        .eq("id", data.user.id)
        .single();

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        setError("Account is not active. Please contact support.");
        setIsLoading(false);
        return;
      }

      // Determine redirect based on role
      let redirectTo = redirect;
      if (!redirectTo) {
        switch (profile.role) {
          case "OWNER":
          case "MANAGER":
          case "OFFICE":
          case "ACCOUNTANT":
            redirectTo = "/app/office";
            break;
          case "CREW_LEAD":
          case "FIELD_TECH":
            redirectTo = "/app/field";
            break;
          case "CLIENT":
            redirectTo = "/app/client";
            break;
          default:
            redirectTo = "/";
        }
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""
          }`,
        },
      });

      if (otpError) {
        setError(otpError.message);
        setIsLoading(false);
        return;
      }

      setMagicLinkSent(true);
      setIsLoading(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-navy-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-navy-900 mb-2">Check your email</h1>
            <p className="text-navy-600 mb-6">
              We sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
            </p>
            <button
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Use a different email
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-navy-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Dog className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">DooGoodScoopers</h1>
            <p className="text-teal-100 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="p-6">
            {/* Auth Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === "password"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode("magic-link")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === "magic-link"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Magic Link
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLinkLogin}>
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-navy-900"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {/* Password (only for password mode) */}
                {mode === "password" && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-navy-900"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {mode === "password" ? "Signing in..." : "Sending link..."}
                    </>
                  ) : (
                    <>
                      {mode === "password" ? "Sign in" : "Send magic link"}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {mode === "password" && (
              <div className="mt-4 text-center">
                <a
                  href="/forgot-password"
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  Forgot your password?
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to home
          </a>
        </div>
      </motion.div>
    </div>
  );
}
