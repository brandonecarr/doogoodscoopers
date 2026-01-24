"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/app/field", icon: Home },
  { name: "Route", href: "/app/field/route", icon: Map },
  { name: "Shift", href: "/app/field/shift", icon: Clock },
  { name: "History", href: "/app/field/history", icon: History },
];

export function FieldBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 min-w-[64px]",
                isActive ? "text-teal-600" : "text-gray-500"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "text-teal-600")} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
