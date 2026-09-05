"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Grid3x3,
  Users2,
  Dog,
  Star,
  Megaphone,
  Rocket,
  Bot,
  Instagram,
  Sparkles,
  Mail,
  Building2,
  Calculator,
  Footprints,
  Split,
  MapPinOff,
  Briefcase,
  ChevronDown,
  LogOut,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { SmsBalanceChip } from "@/components/admin/SmsBalanceChip";

type NavItem = { name: string; short: string; href: string; icon: typeof LayoutDashboard };

// Primary pills shown inline; the rest live under the "More" overflow menu.
// Every destination from the old sidebar is preserved across the two groups.
const primaryNav: NavItem[] = [
  { name: "Dashboard", short: "Dashboard", href: "/admin",           icon: LayoutDashboard },
  { name: "Leads",     short: "Leads",     href: "/admin/leads",     icon: Users2 },
  { name: "Customers", short: "Customers", href: "/admin/customers", icon: Dog },
  { name: "Reviews",   short: "Reviews",   href: "/admin/reviews",   icon: Star },
  { name: "Campaigns", short: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
  { name: "Marketing", short: "Marketing", href: "/admin/marketing", icon: Rocket },
  { name: "Ask DGS",   short: "Ask DGS",   href: "/admin/ask",       icon: Bot },
  { name: "Profitability", short: "Profit", href: "/admin/profitability", icon: TrendingUp },
  { name: "Local Rank Grid", short: "Rank Grid", href: "/admin/rank-grid", icon: Grid3x3 },
];

const moreNav: NavItem[] = [
  { name: "Instagram Auto-DM",    short: "Instagram",  href: "/admin/instagram",   icon: Instagram },
  { name: "Content Studio",       short: "Studio",     href: "/admin/studio",      icon: Sparkles },
  { name: "Funnels",              short: "Funnels",    href: "/admin/funnels",     icon: Split },
  { name: "Email",                short: "Email",      href: "/admin/email",       icon: Mail },
  { name: "Community Quote",      short: "Quote Calc", href: "/admin/community-quote", icon: Calculator },
  { name: "Canvassers",           short: "Canvassers", href: "/admin/canvassers",   icon: Footprints },
  { name: "Out of Area",          short: "Out of Area", href: "/admin/out-of-area", icon: MapPinOff },
  { name: "Career Applications",  short: "Careers",    href: "/admin/careers",     icon: Briefcase },
  { name: "Settings",             short: "Settings",   href: "/admin/settings",    icon: Settings },
];

/** Whether a nav href matches the current path (exact for Dashboard; prefix otherwise). */
function navMatches(pathname: string, href: string): boolean {
  if (href === "/admin/leads") {
    return (
      pathname.startsWith("/admin/leads") ||
      pathname.startsWith("/admin/quote-leads") ||
      pathname.startsWith("/admin/ad-leads") ||
      pathname.startsWith("/admin/instagram-leads") ||
      pathname.startsWith("/admin/canvasser-leads")
    );
  }
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminTopNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on route change.
  useEffect(() => {
    setMoreOpen(false);
    setUserOpen(false);
  }, [pathname]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const moreActive = moreNav.some((i) => navMatches(pathname, i.href));
  const initials = (email?.[0] || "A").toUpperCase();

  return (
    <div className="sticky top-[10px] sm:top-[18px] z-40 mb-[18px]">
      <div className="dgs-card flex items-center gap-3 sm:gap-4 px-3 sm:px-[18px] py-2.5 sm:py-3">
        {/* Brand */}
        <Link href="/admin" className="flex items-center gap-2.5 flex-none">
          <span
            className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center"
            style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}
          >
            <span className="w-[13px] h-[13px] rounded-full border-[2.5px] border-white" />
          </span>
          <span className="hidden sm:block text-[15px] font-extrabold tracking-[-0.02em] whitespace-nowrap text-ink">
            DooGood<span className="text-iris-link">Scoopers</span>
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex-1 min-w-0 flex items-center justify-start lg:justify-center gap-0.5">
          <div className="flex items-center gap-0.5 overflow-x-auto min-w-0 p-0.5 scrollbar-hide">
            {primaryNav.map((item) => {
              const active = navMatches(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-[13px] py-[9px] rounded-[12px] text-[13.5px] font-semibold whitespace-nowrap transition-colors"
                  style={
                    active
                      ? { background: "#101014", color: "#fff" }
                      : { background: "transparent", color: "#5A5A66" }
                  }
                >
                  {item.short}
                </Link>
              );
            })}

            {/* On mobile there's no "More" menu — the overflow items scroll inline
                as pills here (hidden on lg, where the dropdown takes over). */}
            {moreNav.map((item) => {
              const active = navMatches(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="lg:hidden px-[13px] py-[9px] rounded-[12px] text-[13.5px] font-semibold whitespace-nowrap transition-colors"
                  style={
                    active
                      ? { background: "#101014", color: "#fff" }
                      : { background: "transparent", color: "#5A5A66" }
                  }
                >
                  {item.short}
                </Link>
              );
            })}
          </div>

          {/* More overflow — desktop only. On mobile every item is an inline pill above. */}
          <div className="relative flex-none hidden lg:block" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1.5 px-[13px] py-[9px] rounded-[12px] text-[13.5px] font-semibold whitespace-nowrap transition-colors"
                style={
                  moreActive || moreOpen
                    ? { background: "#F4F4F6", color: "#101014" }
                    : { background: "transparent", color: "#5A5A66" }
                }
              >
                More
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {moreOpen && (
                <div className="dgs-pop dgs-anim-pop absolute left-0 lg:left-1/2 lg:-translate-x-1/2 top-[calc(100%+10px)] w-[260px] p-2 z-50">
                  {moreNav.map((item) => {
                    const active = navMatches(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between gap-2 px-3.5 py-[11px] rounded-[14px] text-[13.5px] font-semibold"
                        style={active ? { background: "#EFE9FF", color: "#6D3EF0" } : { color: "#2C2C36" }}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 opacity-70" />
                          {item.name}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-45" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
        </nav>

        {/* Right cluster — existing features preserved */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-none">
          <div className="hidden sm:block">
            <SmsBalanceChip />
          </div>
          <NotificationBell />

          {/* User menu (email + logout) */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((v) => !v)}
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] font-extrabold text-white"
              style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}
              aria-label="Account menu"
            >
              {initials}
            </button>

            {userOpen && (
              <div className="dgs-pop dgs-anim-pop absolute right-0 top-[calc(100%+10px)] w-[240px] p-3 z-50">
                <div className="px-2 pb-2.5 mb-1 border-b border-hairline">
                  <p className="text-[11px] text-muted font-semibold">Signed in as</p>
                  <p className="text-[13px] font-semibold text-ink truncate">{email}</p>
                </div>
                <div className="sm:hidden px-1 py-1">
                  <SmsBalanceChip />
                </div>
                <Link
                  href="/admin/settings"
                  onClick={() => setUserOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13.5px] font-semibold text-bodytext hover:bg-surface2 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings &amp; users
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13.5px] font-semibold text-bodytext hover:bg-surface2 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {isLoggingOut ? "Signing out…" : "Log out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
