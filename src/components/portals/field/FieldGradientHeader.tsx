"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { FieldSidebar } from "./FieldSidebar";
import type { AuthUser } from "@/lib/auth-supabase";

interface FieldGradientHeaderProps {
  user: AuthUser;
  title: string;
  shiftStatus?: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT" | null;
  rating?: number;
  reviewCount?: number;
}

export function FieldGradientHeader({
  user,
  title,
  shiftStatus,
  rating = 5.0,
  reviewCount = 0,
}: FieldGradientHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Gradient Header */}
      <header className="bg-gradient-to-r from-teal-500 to-teal-400 text-white sticky top-0 z-30">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Hamburger Menu */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Title */}
            <h1 className="text-lg font-semibold">{title}</h1>

            {/* Spacer for centering */}
            <div className="w-10" />
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <FieldSidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        shiftStatus={shiftStatus}
        rating={rating}
        reviewCount={reviewCount}
      />
    </>
  );
}
