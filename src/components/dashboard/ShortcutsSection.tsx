"use client";

import Link from "next/link";
import { Smartphone, Users, CalendarPlus, ChevronRight } from "lucide-react";

interface ShortcutItem {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    key: "fieldTechApp",
    title: "Field Tech App",
    subtitle: "Web, Android & iOS",
    icon: <Smartphone className="w-5 h-5 text-teal-600" />,
    href: "/app/field",
  },
  {
    key: "clientPortal",
    title: "Client Portal",
    subtitle: "View Client Portal",
    icon: <Users className="w-5 h-5 text-teal-600" />,
    href: "/client",
  },
  {
    key: "newClientPlanner",
    title: "New Client Planner",
    subtitle: "Service Days and Techs",
    icon: <CalendarPlus className="w-5 h-5 text-teal-600" />,
    href: "/app/office/clients/new",
  },
];

interface ShortcutsSectionProps {
  settings?: Record<string, boolean>;
}

export function ShortcutsSection({ settings }: ShortcutsSectionProps) {
  const visibleShortcuts = SHORTCUTS.filter(s => settings?.[s.key] !== false);

  if (visibleShortcuts.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Shortcuts</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleShortcuts.map((shortcut) => (
          <Link
            key={shortcut.key}
            href={shortcut.href}
            target={shortcut.external ? "_blank" : undefined}
            className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-lg">
                {shortcut.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{shortcut.title}</p>
                <p className="text-xs text-gray-500">{shortcut.subtitle}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}
