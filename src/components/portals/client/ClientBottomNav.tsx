"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CreditCard, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/app/client", icon: Home },
  { name: "Schedule", href: "/app/client/schedule", icon: Calendar },
  { name: "Billing", href: "/app/client/billing", icon: CreditCard },
  { name: "Refer", href: "/app/client/referrals", icon: Share2 },
];

export function ClientBottomNav() {
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
