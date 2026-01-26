"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { usePathname } from "next/navigation";
import { FieldGradientHeader } from "./FieldGradientHeader";
import type { AuthUser } from "@/lib/auth-supabase";

interface ShiftData {
  id: string;
  status: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
}

interface RatingData {
  rating: number;
  reviewCount: number;
}

interface FieldLayoutContextType {
  shiftStatus: ShiftData["status"] | null;
  rating: number;
  reviewCount: number;
  refreshShift: () => Promise<void>;
}

const FieldLayoutContext = createContext<FieldLayoutContextType>({
  shiftStatus: null,
  rating: 5.0,
  reviewCount: 0,
  refreshShift: async () => {},
});

export const useFieldLayout = () => useContext(FieldLayoutContext);

// Page title mapping
const pageTitles: Record<string, string> = {
  "/app/field/route": "Job List",
  "/app/field/shift": "Shift",
  "/app/field/shift/start": "Start Shift",
  "/app/field/shift/end": "End Shift",
  "/app/field/shift/break": "Start Break",
  "/app/field/shift/end-break": "End Break",
  "/app/field/history": "Past Jobs",
  "/app/field/jobs/future": "Future Job List",
  "/app/field/shifts": "My Shifts",
  "/app/field/reviews": "Client Reviews",
  "/app/field/settings": "Settings",
  "/app/field/account/password": "Account",
  "/app/field/account/email": "Account",
  "/app/field/account/picture": "Account",
  "/app/field/payroll/report": "Payroll Report",
  "/app/field/payroll/productivity": "Productivity Report",
  "/app/field/info": "App Info",
};

function getPageTitle(pathname: string): string {
  // Check exact match first
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  // Check for dynamic routes
  if (pathname.match(/^\/app\/field\/route\/[^/]+\/info$/)) {
    return "Client and Location Info";
  }
  if (pathname.startsWith("/app/field/route/")) {
    return "Job Details";
  }
  if (pathname.startsWith("/app/field/history/")) {
    return "Job Details";
  }
  if (pathname.startsWith("/app/field/jobs/future")) {
    return "Future Job List";
  }

  return "Field Tech";
}

interface FieldLayoutClientProps {
  user: AuthUser;
  children: React.ReactNode;
}

export function FieldLayoutClient({ user, children }: FieldLayoutClientProps) {
  const pathname = usePathname();
  const [shiftStatus, setShiftStatus] = useState<ShiftData["status"] | null>(null);
  const [rating, setRating] = useState(5.0);
  const [reviewCount, setReviewCount] = useState(0);

  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch("/api/field/shift");
      if (res.ok) {
        const data = await res.json();
        if (data.shift) {
          setShiftStatus(data.shift.status);
        } else {
          setShiftStatus(null);
        }
      }
    } catch (err) {
      console.error("Error fetching shift:", err);
    }
  }, []);

  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch("/api/field/reviews/summary");
      if (res.ok) {
        const data = await res.json();
        setRating(data.rating || 5.0);
        setReviewCount(data.count || 0);
      }
    } catch (err) {
      // Silently fail - rating is optional
    }
  }, []);

  useEffect(() => {
    fetchShift();
    fetchRating();
  }, [fetchShift, fetchRating]);

  const title = getPageTitle(pathname);

  return (
    <FieldLayoutContext.Provider
      value={{
        shiftStatus,
        rating,
        reviewCount,
        refreshShift: fetchShift,
      }}
    >
      <div className="min-h-screen bg-gray-100">
        <FieldGradientHeader
          user={user}
          title={title}
          shiftStatus={shiftStatus}
          rating={rating}
          reviewCount={reviewCount}
        />
        <main className="pb-8">{children}</main>
      </div>
    </FieldLayoutContext.Provider>
  );
}
