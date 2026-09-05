import Link from "next/link";
import { Building2, Home } from "lucide-react";

/**
 * Residential | Commercial, at the top of the Leads section. Two lists that
 * share a status model but never merge — a commercial inquiry is never folded
 * into a residential quote — so they live side by side rather than as one feed.
 */
export function LeadsSectionSwitch({ active }: { active: "residential" | "commercial" }) {
  const item = (key: "residential" | "commercial", href: string, label: string, Icon: typeof Home) => (
    <Link
      key={key}
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors ${
        active === key ? "bg-white text-ink shadow-sm" : "text-white/70 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  );
  return (
    <div className="flex items-center bg-white/10 rounded-[12px] p-1">
      {item("residential", "/admin/leads", "Residential", Home)}
      {item("commercial", "/admin/leads/commercial", "Commercial", Building2)}
    </div>
  );
}
