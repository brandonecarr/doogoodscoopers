import Link from "next/link";
import {
  FileText,
  MapPinOff,
  Briefcase,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import prisma from "@/lib/prisma";
import type { QuoteLead, OutOfAreaLead, CareerApplication, CommercialLead } from "@/types/leads";

async function getStats() {
  const [
    quoteLeadsTotal,
    quoteLeadsNew,
    outOfAreaTotal,
    outOfAreaNew,
    careersTotal,
    careersNew,
    commercialTotal,
    commercialNew,
  ] = await Promise.all([
    prisma.quoteLead.count(),
    prisma.quoteLead.count({ where: { status: "NEW" } }),
    prisma.outOfAreaLead.count(),
    prisma.outOfAreaLead.count({ where: { status: "NEW" } }),
    prisma.careerApplication.count(),
    prisma.careerApplication.count({ where: { status: "NEW" } }),
    prisma.commercialLead.count(),
    prisma.commercialLead.count({ where: { status: "NEW" } }),
  ]);

  return {
    quoteLeads: { total: quoteLeadsTotal, new: quoteLeadsNew },
    outOfArea: { total: outOfAreaTotal, new: outOfAreaNew },
    careers: { total: careersTotal, new: careersNew },
    commercial: { total: commercialTotal, new: commercialNew },
  };
}

async function getRecentActivity() {
  const [quoteLeads, outOfArea, careers, commercial] = await Promise.all([
    prisma.quoteLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true, createdAt: true, status: true },
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
    ...(outOfArea as Pick<OutOfAreaLead, 'id' | 'firstName' | 'lastName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "outofarea" as const, name: `${l.firstName} ${l.lastName}` })),
    ...(careers as Pick<CareerApplication, 'id' | 'firstName' | 'lastName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "career" as const, name: `${l.firstName} ${l.lastName}` })),
    ...(commercial as Pick<CommercialLead, 'id' | 'contactName' | 'propertyName' | 'createdAt' | 'status'>[]).map((l) => ({ ...l, type: "commercial" as const, name: l.contactName, propertyName: l.propertyName })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return all;
}

const statCards = [
  {
    name: "Quote Leads",
    href: "/admin/quote-leads",
    icon: FileText,
    color: "bg-blue-500",
    lightColor: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Out of Area",
    href: "/admin/out-of-area",
    icon: MapPinOff,
    color: "bg-amber-500",
    lightColor: "bg-amber-50",
    textColor: "text-amber-600",
  },
  {
    name: "Career Applications",
    href: "/admin/careers",
    icon: Briefcase,
    color: "bg-purple-500",
    lightColor: "bg-purple-50",
    textColor: "text-purple-600",
  },
  {
    name: "Commercial Inquiries",
    href: "/admin/commercial",
    icon: Building2,
    color: "bg-teal-500",
    lightColor: "bg-teal-50",
    textColor: "text-teal-600",
  },
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
    case "outofarea": return "Out of Area";
    case "career": return "Career App";
    case "commercial": return "Commercial";
    default: return type;
  }
}

function getTypeHref(type: string, id: string) {
  switch (type) {
    case "quote": return `/admin/quote-leads/${id}`;
    case "outofarea": return `/admin/out-of-area/${id}`;
    case "career": return `/admin/careers/${id}`;
    case "commercial": return `/admin/commercial/${id}`;
    default: return `/admin`;
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const recentActivity = await getRecentActivity();

  const statsData = [
    { ...statCards[0], total: stats.quoteLeads.total, new: stats.quoteLeads.new },
    { ...statCards[1], total: stats.outOfArea.total, new: stats.outOfArea.new },
    { ...statCards[2], total: stats.careers.total, new: stats.careers.new },
    { ...statCards[3], total: stats.commercial.total, new: stats.commercial.new },
  ];

  const totalNew = stats.quoteLeads.new + stats.outOfArea.new + stats.careers.new + stats.commercial.new;

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-navy-600 mt-1">Overview of all leads and applications</p>
      </div>

      {/* Alert for new leads */}
      {totalNew > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-medium text-teal-900">
              You have {totalNew} new lead{totalNew !== 1 ? "s" : ""} to review
            </p>
            <p className="text-sm text-teal-700">
              Check the sections below to see and manage new submissions
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl ${stat.lightColor} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
              {stat.new > 0 && (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${stat.color} text-white`}>
                  {stat.new} new
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm text-navy-600">{stat.name}</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">{stat.total}</p>
            </div>
            <div className="mt-3 flex items-center text-sm text-navy-500 group-hover:text-teal-600 transition-colors">
              <TrendingUp className="w-4 h-4 mr-1" />
              View all
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-navy-500" />
            <h2 className="text-lg font-semibold text-navy-900">Recent Activity</h2>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {recentActivity.length === 0 ? (
            <div className="px-6 py-12 text-center text-navy-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No leads yet</p>
              <p className="text-sm mt-1">New submissions will appear here</p>
            </div>
          ) : (
            recentActivity.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={getTypeHref(item.type, item.id)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${item.status === "NEW" ? "bg-teal-500" : "bg-gray-300"}`} />
                  <div>
                    <p className="font-medium text-navy-900">{item.name}</p>
                    <p className="text-sm text-navy-500">
                      {getTypeLabel(item.type)}
                      {"propertyName" in item && item.propertyName && ` - ${item.propertyName}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-navy-500">{formatDate(item.createdAt)}</p>
                  <p className={`text-xs font-medium ${item.status === "NEW" ? "text-teal-600" : "text-gray-500"}`}>
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
