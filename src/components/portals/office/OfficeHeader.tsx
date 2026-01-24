"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Search, LogOut, User, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/lib/auth-supabase";
import { getRoleDisplayName, getRoleColor } from "@/lib/rbac";

interface OfficeHeaderProps {
  user: AuthUser;
}

export function OfficeHeader({ user }: OfficeHeaderProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden -m-2.5 p-2.5 text-gray-700"
        onClick={() => {
          // TODO: Implement mobile sidebar toggle
        }}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search */}
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search clients, jobs, invoices..."
            type="search"
            name="search"
          />
        </form>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" />
            {/* Notification badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-x-2 p-1.5 -m-1.5"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="text-sm font-medium text-gray-900">
                  {user.firstName || user.email}
                </span>
                <ChevronDown className="ml-1 h-4 w-4 text-gray-400" />
              </span>
            </button>

            {/* Dropdown */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                  <div className="py-1">
                    <a
                      href="/app/office/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="w-4 h-4" />
                      Your Profile
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
