"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dog, LogOut, User, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/lib/auth-supabase";
import { getRoleDisplayName } from "@/lib/rbac";

interface FieldHeaderProps {
  user: AuthUser;
}

export function FieldHeader({ user }: FieldHeaderProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-50 bg-navy-900 text-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Date */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
              <Dog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">DooGoodScoopers</h1>
              <p className="text-xs text-gray-400">{today}</p>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 text-teal-600 bg-teal-100">
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                  <div className="py-1">
                    <a
                      href="/app/field/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </a>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4" />
                      {isLoggingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
