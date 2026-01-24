"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Truck,
  FileText,
  DollarSign,
  MessageSquare,
  Settings,
  Gift,
  Share2,
  Target,
  BarChart3,
  Dog,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth-supabase";
import { hasPermission, type Permission } from "@/lib/rbac";

interface OfficeSidebarProps {
  user: AuthUser;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/app/office", icon: LayoutDashboard },
  { name: "Clients", href: "/app/office/clients", icon: Users, permission: "clients:read" },
  { name: "Scheduling", href: "/app/office/scheduling", icon: Calendar, permission: "jobs:read" },
  { name: "Dispatch", href: "/app/office/dispatch", icon: Truck, permission: "jobs:assign" },
  { name: "Routes", href: "/app/office/routes", icon: MapPin, permission: "routes:read" },
  { name: "Leads", href: "/app/office/leads", icon: Target, permission: "leads:read" },
  { name: "Invoices", href: "/app/office/invoices", icon: FileText, permission: "invoices:read" },
  { name: "Payments", href: "/app/office/payments", icon: DollarSign, permission: "payments:read" },
  { name: "Messages", href: "/app/office/messages", icon: MessageSquare, permission: "notifications:read" },
  { name: "Gift Cards", href: "/app/office/gift-cards", icon: Gift, permission: "gift_certificates:read" },
  { name: "Referrals", href: "/app/office/referrals", icon: Share2, permission: "referrals:read" },
  { name: "Reports", href: "/app/office/reports", icon: BarChart3, permission: "reports:read" },
  { name: "Settings", href: "/app/office/settings", icon: Settings, permission: "settings:read" },
];

export function OfficeSidebar({ user }: OfficeSidebarProps) {
  const pathname = usePathname();

  // Filter navigation items based on user permissions
  const filteredNav = navigation.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user.role, item.permission);
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-navy-900 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
              <Dog className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white font-bold">DooGoodScoopers</span>
              <p className="text-xs text-gray-400">Office Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {filteredNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6 transition-colors",
                        isActive
                          ? "bg-teal-600 text-white"
                          : "text-gray-300 hover:bg-navy-800 hover:text-white"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                        )}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info */}
          <div className="border-t border-navy-700 pt-4">
            <div className="flex items-center gap-x-3 p-2">
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user.firstName || user.email}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy-900 border-t border-navy-700">
        <nav className="flex justify-around py-2">
          {filteredNav.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1",
                  isActive ? "text-teal-400" : "text-gray-400"
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
