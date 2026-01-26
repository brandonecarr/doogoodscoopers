"use client";

import Link from "next/link";
import { BookOpen, Video, Mail, Phone, ChevronRight } from "lucide-react";

interface AssistanceItem {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
}

const ASSISTANCE_ITEMS: AssistanceItem[] = [
  {
    key: "writtenTutorials",
    title: "Written Tutorials",
    subtitle: "Over 50 How-To's",
    icon: <BookOpen className="w-5 h-5 text-teal-600" />,
    href: "https://help.sweepandgo.com",
    external: true,
  },
  {
    key: "liveTraining",
    title: "Live Training",
    subtitle: "Schedule web meeting",
    icon: <Video className="w-5 h-5 text-teal-600" />,
    href: "https://calendly.com/sweepandgo",
    external: true,
  },
  {
    key: "emailSupport",
    title: "Email Support",
    subtitle: "hello@sweepandgo.com",
    icon: <Mail className="w-5 h-5 text-teal-600" />,
    href: "mailto:hello@sweepandgo.com",
  },
  {
    key: "urgentHelp",
    title: "Urgent Help (M-F 6AM-5PM ET)",
    subtitle: "Text 207-956-0474",
    icon: <Phone className="w-5 h-5 text-teal-600" />,
    href: "sms:+12079560474",
  },
];

interface AssistanceSectionProps {
  settings?: Record<string, boolean>;
}

export function AssistanceSection({ settings }: AssistanceSectionProps) {
  const visibleItems = ASSISTANCE_ITEMS.filter(item => settings?.[item.key] !== false);

  if (visibleItems.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Assistance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-lg">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.subtitle}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}
