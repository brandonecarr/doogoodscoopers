"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Home,
  User,
  Calendar,
  CreditCard,
  Share2,
  Settings,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/lib/auth-supabase";

interface ClientSidebarProps {
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
  children?: NavSubItem[];
}

const navigation: NavItem[] = [
  {
    name: "Home",
    href: "/app/client",
    icon: Home,
  },
  {
    name: "My Profile",
    icon: User,
    children: [
      { name: "Contact Info", href: "/app/client/profile" },
      { name: "Location", href: "/app/client/locations" },
      { name: "Dog Info", href: "/app/client/dogs" },
    ],
  },
  {
    name: "Cleanups",
    href: "/app/client/schedule",
    icon: Calendar,
  },
  {
    name: "Billing",
    icon: CreditCard,
    children: [
      { name: "Subscriptions", href: "/app/client/subscription" },
      { name: "Invoices", href: "/app/client/billing" },
      { name: "Payment Methods", href: "/app/client/billing/methods" },
    ],
  },
  {
    name: "Refer a Friend",
    href: "/app/client/referrals",
    icon: Share2,
  },
  {
    name: "Settings",
    icon: Settings,
    children: [
      { name: "Notifications", href: "/app/client/settings" },
    ],
  },
];

// Mobile bottom nav items (subset)
const mobileNav: NavItem[] = [
  { name: "Home", href: "/app/client", icon: Home },
  { name: "Cleanups", href: "/app/client/schedule", icon: Calendar },
  { name: "Billing", href: "/app/client/billing", icon: CreditCard },
  { name: "Refer", href: "/app/client/referrals", icon: Share2 },
  { name: "Profile", href: "/app/client/profile", icon: User },
];

export function ClientSidebar({ user }: ClientSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Auto-expand the section that contains the current path
  useEffect(() => {
    for (const item of navigation) {
      if (item.children) {
        const isChildActive = item.children.some((child) => {
          return pathname === child.href || pathname.startsWith(child.href + "/");
        });
        if (isChildActive) {
          setExpandedItem(item.name);
          return;
        }
      }
    }
  }, [pathname]);

  const toggleExpand = (name: string) => {
    setExpandedItem((prev) => (prev === name ? null : name));
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.href) {
      return item.href === "/app/client"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
    }
    if (item.children) {
      return item.children.some(
        (child) => pathname === child.href || pathname.startsWith(child.href + "/")
      );
    }
    return false;
  };

  const isSubItemActive = (href: string, siblings: NavSubItem[] = []): boolean => {
    const isMatch = pathname === href || pathname.startsWith(href + "/");
    if (!isMatch) return false;

    // Check if a sibling is a more specific match
    const hasBetterSibling = siblings.some((sibling) => {
      if (sibling.href === href) return false;
      return (pathname === sibling.href || pathname.startsWith(sibling.href + "/")) &&
        sibling.href.length > href.length;
    });

    return !hasBetterSibling;
  };

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div
          className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 px-4 pb-4"
          style={{ backgroundColor: "#9CD5CF" }}
        >
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3 px-2">
            <Image
              src="/dog-icon.svg"
              alt="DooGoodScoopers"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <div>
              <span className="text-white font-bold">DooGoodScoopers</span>
              <p className="text-xs text-white/70">Client Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {navigation.map((item) => {
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
                              const childActive = isSubItemActive(child.href, item.children);
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
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-white/70 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-2 w-full flex items-center gap-x-3 rounded-md p-2 text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <nav className="flex justify-around py-2">
          {mobileNav.map((item) => {
            const isActive = item.href === "/app/client"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href! + "/");
            return (
              <Link
                key={item.name}
                href={item.href!}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]",
                  isActive ? "text-teal-600" : "text-gray-400"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
