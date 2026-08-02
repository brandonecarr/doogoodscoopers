"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  MapPinOff,
  Briefcase,
  Building2,
  Users,
  Megaphone,
  Dog,
  Star,
  Mail,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard",            short: "Dashboard",  href: "/admin",             icon: LayoutDashboard },
  { name: "Leads",                short: "Leads",      href: "/admin/leads",       icon: Users2 },
  { name: "Customers",            short: "Customers",  href: "/admin/customers",   icon: Dog },
  { name: "Reviews",              short: "Reviews",    href: "/admin/reviews",     icon: Star },
  { name: "Messenger",            short: "Messenger",  href: "/admin/messenger",   icon: MessageCircle },
  { name: "Campaigns",            short: "Campaigns",  href: "/admin/campaigns",   icon: Megaphone },
  { name: "Email",                short: "Email",      href: "/admin/email",       icon: Mail },
  { name: "Commercial Inquiries", short: "Commercial", href: "/admin/commercial",  icon: Building2 },
  { name: "Out of Area",          short: "Out of Area", href: "/admin/out-of-area", icon: MapPinOff },
  { name: "Career Applications",  short: "Careers",    href: "/admin/careers",     icon: Briefcase },
];

/** Whether a nav href matches the current path (exact for Dashboard; prefix otherwise). */
function navMatches(pathname: string, href: string): boolean {
  if (href === "/admin/leads") {
    return (
      pathname.startsWith("/admin/leads") ||
      pathname.startsWith("/admin/quote-leads") ||
      pathname.startsWith("/admin/ad-leads")
    );
  }
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-navy-900 pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center justify-center flex-shrink-0 px-4">
            <Link href="/admin">
              <Image
                src="/logo-dark.webp"
                alt="DooGoodScoopers"
                width={150}
                height={50}
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = navMatches(pathname, item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-teal-500 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-white" : "text-white/60 group-hover:text-white"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Admin badge */}
          <div className="flex-shrink-0 px-4 py-4">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Users className="w-4 h-4" />
              Admin Portal
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar — horizontally scrollable so every link fits.
          Safe-area padding keeps it clear of the home indicator / browser chrome. */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-white/10 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav className="flex overflow-x-auto overscroll-x-contain gap-1 px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map((item) => {
            const isActive = navMatches(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-shrink-0 min-w-[68px] flex-col items-center px-2 py-1 text-[11px] font-medium",
                  isActive ? "text-teal-400" : "text-white/60"
                )}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span className="whitespace-nowrap">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
