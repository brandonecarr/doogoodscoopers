"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MapPinOff,
  Briefcase,
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Quote Leads", href: "/admin/quote-leads", icon: FileText },
  { name: "Out of Area", href: "/admin/out-of-area", icon: MapPinOff },
  { name: "Career Applications", href: "/admin/careers", icon: Briefcase },
  { name: "Commercial Inquiries", href: "/admin/commercial", icon: Building2 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-navy-900 pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <Link href="/admin">
              <Image
                src="/logo.png"
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
              const isActive = pathname === item.href;
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

      {/* Mobile sidebar - simple version */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-white/10 z-50">
        <nav className="flex justify-around py-2">
          {navigation.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center px-2 py-1 text-xs",
                  isActive ? "text-teal-400" : "text-white/60"
                )}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span className="truncate max-w-[60px]">{item.name.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
