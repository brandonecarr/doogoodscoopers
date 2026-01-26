"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  X,
  ArrowRightFromLine,
  Pause,
  List,
  CalendarDays,
  History,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
  User,
  Lock,
  Mail,
  ImageIcon,
  MessageSquare,
  Settings,
  Info,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/lib/auth-supabase";
import { cn } from "@/lib/utils";

interface FieldSidebarProps {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  shiftStatus?: "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT" | null;
  rating?: number;
  reviewCount?: number;
}

export function FieldSidebar({
  user,
  isOpen,
  onClose,
  shiftStatus,
  rating = 5.0,
  reviewCount = 0,
}: FieldSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [payrollExpanded, setPayrollExpanded] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href;

  // Determine which shift action to show based on status
  const getShiftAction = () => {
    if (!shiftStatus || shiftStatus === "CLOCKED_OUT") {
      return { label: "Start Shift", href: "/app/field/shift/start", icon: ArrowRightFromLine };
    }
    if (shiftStatus === "ON_BREAK") {
      return { label: "End Break", href: "/app/field/shift/end-break", icon: Pause };
    }
    return { label: "End Shift", href: "/app/field/shift/end", icon: ArrowRightFromLine };
  };

  const shiftAction = getShiftAction();

  // Render star rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-4 h-4",
              star <= rating ? "fill-teal-500 text-teal-500" : "fill-gray-300 text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 ease-in-out shadow-xl overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Profile Section */}
        <div className="pt-8 pb-4 px-4 border-b border-gray-200">
          {/* Profile Picture */}
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {user.firstName?.[0] || user.email[0].toUpperCase()}
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {renderStars(rating)}
            <span className="text-sm text-gray-600">
              Based on {reviewCount} client opinions
            </span>
          </div>

          {/* Name and Company */}
          <div className="text-center">
            <h3 className="font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-sm text-gray-500">DooGoodScoopers</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="py-2">
          {/* Shift Action */}
          <Link
            href={shiftAction.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive(shiftAction.href) && "bg-teal-50 text-teal-600"
            )}
          >
            <shiftAction.icon className="w-5 h-5" />
            <span>{shiftAction.label}</span>
          </Link>

          {/* Break (only when clocked in) */}
          {shiftStatus === "CLOCKED_IN" && (
            <Link
              href="/app/field/shift/break"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
                isActive("/app/field/shift/break") && "bg-teal-50 text-teal-600"
              )}
            >
              <Pause className="w-5 h-5" />
              <span>Break</span>
            </Link>
          )}

          {/* Job List */}
          <Link
            href="/app/field/route"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/route") && "bg-teal-50 text-teal-600"
            )}
          >
            <List className="w-5 h-5" />
            <span>Job List</span>
          </Link>

          {/* Future Jobs */}
          <Link
            href="/app/field/jobs/future"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/jobs/future") && "bg-teal-50 text-teal-600"
            )}
          >
            <CalendarDays className="w-5 h-5" />
            <span>Future Jobs</span>
          </Link>

          {/* Past Jobs */}
          <Link
            href="/app/field/history"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/history") && "bg-teal-50 text-teal-600"
            )}
          >
            <History className="w-5 h-5" />
            <span>Past Jobs</span>
          </Link>

          {/* My Shifts */}
          <Link
            href="/app/field/shifts"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/shifts") && "bg-teal-50 text-teal-600"
            )}
          >
            <Calendar className="w-5 h-5" />
            <span>My Shifts</span>
          </Link>

          {/* Payroll (expandable) */}
          <div>
            <button
              onClick={() => setPayrollExpanded(!payrollExpanded)}
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5" />
                <span>Payroll</span>
              </div>
              {payrollExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            {payrollExpanded && (
              <div className="pl-8">
                <Link
                  href="/app/field/payroll/report"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50",
                    isActive("/app/field/payroll/report") && "bg-teal-50 text-teal-600"
                  )}
                >
                  <FileText className="w-5 h-5" />
                  <span>Payroll Report</span>
                </Link>
                <Link
                  href="/app/field/payroll/productivity"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50",
                    isActive("/app/field/payroll/productivity") && "bg-teal-50 text-teal-600"
                  )}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Productivity Report</span>
                </Link>
              </div>
            )}
          </div>

          {/* Account (expandable) */}
          <div>
            <button
              onClick={() => setAccountExpanded(!accountExpanded)}
              className="flex items-center justify-between w-full px-4 py-3 text-gray-700 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5" />
                <span>Account</span>
              </div>
              {accountExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            {accountExpanded && (
              <div className="pl-8">
                <Link
                  href="/app/field/account/password"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50",
                    isActive("/app/field/account/password") && "bg-teal-50 text-teal-600"
                  )}
                >
                  <Lock className="w-5 h-5" />
                  <span>Change Password</span>
                </Link>
                <Link
                  href="/app/field/account/email"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50",
                    isActive("/app/field/account/email") && "bg-teal-50 text-teal-600"
                  )}
                >
                  <Mail className="w-5 h-5" />
                  <span>Change Email</span>
                </Link>
                <Link
                  href="/app/field/account/picture"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50",
                    isActive("/app/field/account/picture") && "bg-teal-50 text-teal-600"
                  )}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>Profile Picture</span>
                </Link>
              </div>
            )}
          </div>

          {/* Client Reviews */}
          <Link
            href="/app/field/reviews"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/reviews") && "bg-teal-50 text-teal-600"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Client Reviews</span>
          </Link>

          {/* Settings */}
          <Link
            href="/app/field/settings"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/settings") && "bg-teal-50 text-teal-600"
            )}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>

          {/* App Info */}
          <Link
            href="/app/field/info"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50",
              isActive("/app/field/info") && "bg-teal-50 text-teal-600"
            )}
          >
            <Info className="w-5 h-5" />
            <span>App Info</span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <ArrowRightFromLine className="w-5 h-5 rotate-180" />
            <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </nav>
      </div>
    </>
  );
}
