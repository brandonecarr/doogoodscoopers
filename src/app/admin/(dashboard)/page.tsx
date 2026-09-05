import Link from "next/link";
import {
  FileText,
  MapPinOff,
  Briefcase,
  Building2,
  Megaphone,
  ArrowUpRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import prisma from "@/lib/prisma";
import type { QuoteLead, OutOfAreaLead, CareerApplication, CommercialLead, AdLead } from "@/types/leads";

async function getStats() {
  const [
    quoteLeadsTotal,
    quoteLeadsNew,
    adLeadsTotal,
    adLeadsNew,
    outOfAreaTotal,
    outOfAreaNew,
    careersTotal,
    careersNew,
    commercialTotal,
    commercialNew,
  ] = await Promise.all([
    prisma.quoteLead.count(),
    prisma.quoteLead.count({ where: { status: "NEW" } }),
    prisma.adLead.count(),
    prisma.adLead.count({ where: { status: "NEW" } }),
    prisma.outOfAreaLead.count(),
    prisma.outOfAreaLead.count({ where: { status: "NEW" } }),
    prisma.careerApplication.count(),
    prisma.careerApplication.count({ where: { status: "NEW" } }),
    prisma.commercialLead.count(),
    prisma.commercialLead.count({ where: { status: "NEW" } }),
  ]);

  return {
    quoteLeads: { total: quoteLeadsTotal, new: quoteLeadsNew },
    adLeads: { total: adLeadsTotal, new: adLeadsNew },
    outOfArea: { total: outOfAreaTotal, new: outOfAreaNew },
    careers: { total: careersTotal, new: careersNew },
    commercial: { total: commercialTotal, new: commercialNew },
  };
}

async function getRecentActivity() {
  const [quoteLeads, adLeads, outOfArea, careers, commercial] = await Promise.all([
    prisma.quoteLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true, createdAt: true, status: true },
    }),
    prisma.adLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true, fullName: true, createdAt: true, status: true },
    }),
    prisma.outOfAreaLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true, createdAt: true, status: true },
    }),
    prisma.careerApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true, createdAt: true, status: true },
    }),
    prisma.commercialLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, contactName: true, propertyName: true, createdAt: true, status: true },
    }),
  ]);

  // Combine and sort by date
  const all = [
    ...(quoteLeads as Pick<QuoteLead, 'id' | 'firstName' | 'lastName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "quote" as const, name: `${l.firstName} ${l.lastName || ""}`.trim() })),
    ...(adLeads as Pick<AdLead, 'id' | 'firstName' | 'lastName' | 'fullName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "adlead" as const, name: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown" })),
    ...(outOfArea as Pick<OutOfAreaLead, 'id' | 'firstName' | 'lastName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "outofarea" as const, name: `${l.firstName} ${l.lastName}` })),
    ...(careers as Pick<CareerApplication, 'id' | 'firstName' | 'lastName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "career" as const, name: `${l.firstName} ${l.lastName}` })),
    ...(commercial as Pick<CommercialLead, 'id' | 'contactName' | 'propertyName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "commercial" as const, name: l.contactName, propertyName: l.propertyName })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return all;
}

const statCards = [
  { name: "Quote Leads",          href: "/admin/quote-leads", icon: FileText,   grad: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" },
  { name: "Ad Leads",             href: "/admin/ad-leads",    icon: Megaphone,  grad: "linear-gradient(150deg,#FFC9DE,#F0369C)" },
  { name: "Out of Area",          href: "/admin/out-of-area", icon: MapPinOff,  grad: "linear-gradient(150deg,#FFD9A8,#F5A623)" },
  { name: "Career Applications",  href: "/admin/careers",     icon: Briefcase,  grad: "linear-gradient(150deg,#C8B9FF,#7C5CFC)" },
  { name: "Commercial Leads", href: "/admin/leads/commercial",  icon: Building2,  grad: "linear-gradient(150deg,#9BE7C0,#12A150)" },
];

function formatDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function getTypeLabel(type: string) {
  switch (type) {
    case "quote": return "Quote Lead";
    case "adlead": return "Ad Lead";
    case "outofarea": return "Out of Area";
    case "career": return "Career App";
    case "commercial": return "Commercial";
    default: return type;
  }
}

function getTypeHref(type: string, id: string) {
  switch (type) {
    case "quote": return `/admin/quote-leads/${id}`;
    case "adlead": return `/admin/ad-leads/${id}`;
    case "outofarea": return `/admin/out-of-area/${id}`;
    case "career": return `/admin/careers/${id}`;
    case "commercial": return `/admin/leads/commercial/${id}`;
    default: return `/admin`;
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const recentActivity = await getRecentActivity();

  const statsData = [
    { ...statCards[0], total: stats.quoteLeads.total, new: stats.quoteLeads.new },
    { ...statCards[1], total: stats.adLeads.total, new: stats.adLeads.new },
    { ...statCards[2], total: stats.outOfArea.total, new: stats.outOfArea.new },
    { ...statCards[3], total: stats.careers.total, new: stats.careers.new },
    { ...statCards[4], total: stats.commercial.total, new: stats.commercial.new },
  ];

  const totalNew = stats.quoteLeads.new + stats.adLeads.new + stats.outOfArea.new + stats.careers.new + stats.commercial.new;
  const totalLeads = stats.quoteLeads.total + stats.adLeads.total + stats.outOfArea.total + stats.commercial.total;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const heroKpis = [
    { label: "New to review", value: totalNew,               icon: "◔", chipBg: "rgba(139,107,255,.22)", chipFg: "#C8B9FF" },
    { label: "Quote leads",   value: stats.quoteLeads.total, icon: "◆", chipBg: "rgba(139,107,255,.22)", chipFg: "#C8B9FF" },
    { label: "Ad leads",      value: stats.adLeads.total,    icon: "✦", chipBg: "rgba(240,54,156,.20)",  chipFg: "#FFC9DE" },
    { label: "Commercial",    value: stats.commercial.total, icon: "▲", chipBg: "rgba(18,161,80,.20)",   chipFg: "#9BE7C0" },
  ];

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4 px-1">
        <div>
          <h1 className="dgs-title">Dashboard</h1>
          <p className="dgs-sub">
            {today} · {totalLeads} total leads
            {totalNew > 0 ? ` · ${totalNew} new to review` : " · all caught up"}
          </p>
        </div>
      </div>

      {/* Dark KPI hero — real counts */}
      <div className="dgs-hero p-[26px]">
        <div className="text-[26px] font-extrabold text-white tracking-[-0.03em]">Today&apos;s overview</div>
        <div className="grid gap-3 mt-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {heroKpis.map((k) => (
            <div key={k.label} className="dgs-hero-tile p-[18px]">
              <div className="text-[12.5px] text-[#9C9CB0]">{k.label}</div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-[38px] font-extrabold text-white tracking-[-0.035em] leading-none">{k.value}</div>
                <div
                  className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[15px]"
                  style={{ background: k.chipBg, color: k.chipFg }}
                >
                  {k.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-3.5">
        {statsData.map((stat) => (
          <Link key={stat.name} href={stat.href} className="dgs-card dgs-lift p-5 group">
            <div className="flex items-center justify-between">
              <div
                className="w-11 h-11 rounded-[13px] flex items-center justify-center"
                style={{ background: stat.grad }}
              >
                <stat.icon className="w-[22px] h-[22px] text-white" />
              </div>
              {stat.new > 0 && <span className="dgs-badge dgs-badge-iris">{stat.new} new</span>}
            </div>
            <div className="mt-4">
              <p className="text-[12.5px] text-muted2 font-medium">{stat.name}</p>
              <p className="text-[32px] font-extrabold text-ink tracking-[-0.035em] mt-0.5">{stat.total}</p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-muted group-hover:text-iris-link transition-colors">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="dgs-card mt-3.5 overflow-hidden">
        <div className="px-[22px] py-[18px] flex items-center gap-2">
          <Clock className="w-[18px] h-[18px] text-muted" />
          <h2 className="dgs-card-title">Recent activity</h2>
        </div>
        <div>
          {recentActivity.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#D8D8DE]" />
              <p className="font-semibold text-bodytext">No leads yet</p>
              <p className="text-sm mt-1">New submissions will appear here</p>
            </div>
          ) : (
            recentActivity.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={getTypeHref(item.type, item.id)}
                className="dgs-row px-[22px] py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-2 h-2 rounded-full ${item.status === "NEW" ? "bg-iris" : "bg-[#D8D8DE]"}`} />
                  <div>
                    <p className="font-bold text-[14px] text-ink">{item.name}</p>
                    <p className="text-[12px] text-muted">
                      {getTypeLabel(item.type)}
                      {"propertyName" in item && item.propertyName && ` · ${item.propertyName}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-muted">{formatDate(item.createdAt)}</p>
                  <p className={`text-[11px] font-bold ${item.status === "NEW" ? "text-iris-link" : "text-muted"}`}>
                    {item.status}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
