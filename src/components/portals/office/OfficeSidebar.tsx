"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  UserCog,
  Calendar,
  CreditCard,
  DollarSign,
  BarChart3,
  Settings,
  ChevronDown,
  Dog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth-supabase";
import { hasPermission, type Permission } from "@/lib/rbac";

interface OfficeSidebarProps {
  user: AuthUser;
}

interface NavSubItem {
  name: string;
  href: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  children?: NavSubItem[];
}

const navigation: NavItem[] = [
  {
    name: "Home",
    href: "/app/office",
    icon: Home,
  },
  {
    name: "Clients",
    icon: Users,
    permission: "clients:read",
    children: [
      { name: "Residential Clients", href: "/app/office/clients?type=residential" },
      { name: "Commercial Clients", href: "/app/office/clients?type=commercial" },
      { name: "Change Requests", href: "/app/office/change-requests" },
    ],
  },
  {
    name: "Staff",
    icon: UserCog,
    permission: "staff:read",
    children: [
      { name: "Staff List", href: "/app/office/staff" },
      { name: "Shifts", href: "/app/office/shifts" },
      { name: "My Shift Report", href: "/app/office/shifts/my-report" },
      { name: "Time & Mileage Report", href: "/app/office/shifts/time-mileage" },
      { name: "Start/End My Shift", href: "/app/office/shifts/clock" },
    ],
  },
  {
    name: "Scheduler",
    icon: Calendar,
    permission: "jobs:read",
    children: [
      { name: "Dispatch Board", href: "/app/office/dispatch" },
      { name: "Route Manager", href: "/app/office/routes" },
      { name: "Schedule", href: "/app/office/scheduling" },
      { name: "Unassigned", href: "/app/office/unassigned" },
    ],
  },
  {
    name: "Billing",
    icon: CreditCard,
    permission: "invoices:read",
    children: [
      { name: "Residential Subscriptions", href: "/app/office/subscriptions/residential" },
      { name: "Commercial Subscriptions", href: "/app/office/subscriptions/commercial" },
      { name: "Recurring Invoices", href: "/app/office/invoices" },
      { name: "One Time Invoices", href: "/app/office/invoices/one-time" },
      { name: "Payments", href: "/app/office/payments" },
      { name: "Coupons", href: "/app/office/coupons" },
      { name: "Gift Certificates", href: "/app/office/gift-cards" },
      { name: "Payouts", href: "/app/office/payouts" },
      { name: "Sales Tax Report", href: "/app/office/reports/sales-tax" },
    ],
  },
  {
    name: "Payroll",
    icon: DollarSign,
    permission: "staff:read",
    children: [
      { name: "Create Pay Slips", href: "/app/office/payroll/pay-slips" },
      { name: "Payroll Report", href: "/app/office/payroll/report" },
      { name: "Productivity Report", href: "/app/office/payroll/productivity" },
    ],
  },
  {
    name: "Reports",
    icon: BarChart3,
    permission: "reports:read",
    children: [
      { name: "Route Planning", href: "/app/office/route-planner" },
      { name: "Completed Jobs", href: "/app/office/reports/completed-jobs" },
      { name: "Residential Cross-Sells", href: "/app/office/reports/residential-cross-sells" },
      { name: "Commercial Cross-Sells", href: "/app/office/reports/commercial-cross-sells" },
      { name: "Open Balance Report", href: "/app/office/reports/open-balance" },
      { name: "Cleanup Notifications Report", href: "/app/office/reports/cleanup-notifications" },
      { name: "Ratings & Comments", href: "/app/office/reports/ratings" },
      { name: "Tips", href: "/app/office/reports/tips" },
      { name: "Work Area Activity Log", href: "/app/office/reports/activity-log" },
      { name: "Work Area Inventory", href: "/app/office/reports/inventory" },
    ],
  },
  {
    name: "Settings",
    href: "/app/office/settings",
    icon: Settings,
    permission: "settings:read",
  },
];

export function OfficeSidebar({ user }: OfficeSidebarProps) {
  const pathname = usePathname();
  const [expandedItem, setExpandedItem] = useState<string | null>(() => {
    // Auto-expand the section that contains the current path
    for (const item of navigation) {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) => pathname === child.href || pathname.startsWith(child.href.split("?")[0] + "/")
        );
        if (isChildActive) {
          return item.name;
        }
      }
    }
    return null;
  });

  const toggleExpand = (name: string) => {
    setExpandedItem((prev) => (prev === name ? null : name));
  };

  // Filter navigation items based on user permissions
  const filteredNav = navigation.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user.role, item.permission);
  });

  const isItemActive = (item: NavItem): boolean => {
    if (item.href) {
      return item.href === "/app/office"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
    }
    if (item.children) {
      return item.children.some(
        (child) => pathname === child.href.split("?")[0] || pathname.startsWith(child.href.split("?")[0] + "/")
      );
    }
    return false;
  };

  const isSubItemActive = (href: string): boolean => {
    const basePath = href.split("?")[0];
    return pathname === basePath || pathname.startsWith(basePath + "/");
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 px-4 pb-4" style={{ backgroundColor: '#9CD5CF' }}>
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3 px-2">
            <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
              <Dog className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white font-bold">DooGoodScoopers</span>
              <p className="text-xs text-white/70">Office Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {filteredNav.map((item) => {
                const isActive = isItemActive(item);
                const isExpanded = expandedItem === item.name;
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <li key={item.name}>
                    {hasChildren ? (
                      <>
                        <button
                          onClick={() => toggleExpand(item.name)}
                          className={cn(
                            "w-full group flex items-center justify-between rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                            isActive
                              ? "bg-white/30 text-white"
                              : "text-white hover:bg-white/20"
                          )}
                        >
                          <div className="flex items-center gap-x-3">
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isActive ? "text-white" : "text-white/80"
                              )}
                            />
                            {item.name}
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-white/80 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <ul className="mt-1 space-y-1">
                            {item.children?.map((child) => {
                              const childActive = isSubItemActive(child.href);
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      "block rounded-md py-2 pl-11 pr-2 text-sm font-medium leading-6 transition-colors",
                                      childActive
                                        ? "bg-white/30 text-white font-semibold"
                                        : "text-white/80 hover:bg-white/20 hover:text-white"
                                    )}
                                  >
                                    {child.name}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href!}
                        className={cn(
                          "group flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                          isActive
                            ? "bg-white/30 text-white"
                            : "text-white hover:bg-white/20"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0",
                            isActive ? "text-white" : "text-white/80"
                          )}
                        />
                        {item.name}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info */}
          <div className="border-t border-white/30 pt-4">
            <div className="flex items-center gap-x-3 p-2">
              <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user.firstName || user.email}
                </p>
                <p className="text-xs text-white/70 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <nav className="flex justify-around py-2">
          {filteredNav.slice(0, 5).map((item) => {
            const isActive = isItemActive(item);
            const href = item.href || (item.children?.[0]?.href ?? "/app/office");
            return (
              <Link
                key={item.name}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1",
                  isActive ? "text-teal-600" : "text-gray-400"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
