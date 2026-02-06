"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dog, LogOut, Settings, Bell, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/lib/auth-supabase";

interface ClientHeaderProps {
  user: AuthUser;
}

export function ClientHeader({ user }: ClientHeaderProps) {
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

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo - mobile only (sidebar has logo on desktop) */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
              <Dog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-navy-900">DooGoodScoopers</h1>
              <p className="text-xs text-gray-500">Client Portal</p>
            </div>
          </div>
          {/* Spacer on desktop */}
          <div className="hidden lg:block" />

          {/* Right side: notification bell + user menu */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-sm font-medium">
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
                <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <a
                      href="/app/client/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
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
      </div>
    </header>
  );
}
