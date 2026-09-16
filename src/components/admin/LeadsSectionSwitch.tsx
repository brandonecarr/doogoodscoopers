import Link from "next/link";
import { Building2, Home, PhoneCall, CalendarDays } from "lucide-react";

type SectionKey = "residential" | "commercial" | "callList" | "calendar";

/**
 * Residential | Commercial | Call List | Calendar, at the top of the Leads
 * section. The lead lists share a status model but never merge; the calendar is
 * a cross-cutting view of every list's follow-ups plus manual entries.
 */
export function LeadsSectionSwitch({ active }: { active: SectionKey }) {
  const item = (key: SectionKey, href: string, label: string, Icon: typeof Home) => (
    <Link
      key={key}
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active === key ? "bg-white text-ink shadow-sm" : "text-white/70 hover:text-white"
      }`}
      title={label}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className={active === key ? "" : "hidden sm:inline"}>{label}</span>
    </Link>
  );
  return (
    <div className="flex items-center bg-white/10 rounded-[12px] p-1 flex-shrink-0">
      {item("residential", "/admin/leads", "Residential", Home)}
      {item("commercial", "/admin/leads/commercial", "Commercial", Building2)}
      {item("callList", "/admin/leads/commercial/call-list", "Call List", PhoneCall)}
      {item("calendar", "/admin/leads/calendar", "Calendar", CalendarDays)}
    </div>
  );
}
