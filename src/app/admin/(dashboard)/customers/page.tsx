import Link from "next/link";
import { Dog, Search, Archive, RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { CustomerReviewControl } from "@/components/admin/CustomerReviewControl";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; sort?: string; dir?: string }>;
}

function fmtPhone(raw: string | null) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}
function fmtSynced(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Sort key → Prisma orderBy
const SORTS: Record<string, (dir: "asc" | "desc") => Prisma.SweepandgoCustomerOrderByWithRelationInput[]> = {
  name:         (d) => [{ lastName: d }, { firstName: d }],
  start:        (d) => [{ startDate: d }, { firstSeenAt: d }],
  address:      (d) => [{ address: d }],
  subscription: (d) => [{ subscriptionNames: d }],
  serviceDay:   (d) => [{ serviceDays: d }],
  frequency:    (d) => [{ cleanupFrequency: d }],
  tech:         (d) => [{ assignedTo: d }],
  review:       (d) => [{ reviewStatus: d }],
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const { search, sort: sortRaw, dir: dirRaw } = await searchParams;
  // Headers pass sort + dir separately; the dropdown passes a combined "key:dir".
  let sortKey = sortRaw;
  let dirKey = dirRaw;
  if (sortRaw?.includes(":")) { const [s, d] = sortRaw.split(":"); sortKey = s; dirKey = d; }
  const sort = sortKey && SORTS[sortKey] ? sortKey : "name";
  const dir: "asc" | "desc" = dirKey === "desc" ? "desc" : "asc";

  const where: Prisma.SweepandgoCustomerWhereInput = { active: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { cellPhone: { contains: search } },
      { address: { contains: search, mode: "insensitive" } },
      { zipCode: { contains: search } },
    ];
  }

  const [customers, totalActive, archivedCount, lastSync] = await Promise.all([
    prisma.sweepandgoCustomer.findMany({ where, orderBy: SORTS[sort](dir) }),
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    prisma.sweepandgoCustomer.count({ where: { active: false } }),
    prisma.sweepandgoCustomer.aggregate({ _max: { lastSyncedAt: true } }),
  ]);
  const lastSyncedAt = lastSync._max.lastSyncedAt;

  // Build a sortable column header (link that toggles direction).
  const qs = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    return `/admin/customers?${p}`;
  };
  const renderTh = (label: string, sortKey?: string) => {
    if (!sortKey) {
      return <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{label}</th>;
    }
    const active = sort === sortKey;
    const nextDir = active && dir === "asc" ? "desc" : "asc";
    return (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
        <Link href={qs({ sort: sortKey, dir: nextDir })} className={`inline-flex items-center gap-1 hover:text-navy-900 ${active ? "text-navy-900" : ""}`}>
          {label}
          {active && (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        </Link>
      </th>
    );
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Customers</h1>
          <p className="text-navy-600 mt-1">{totalActive} active Sweep&amp;Go customers</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
          <Dog className="w-6 h-6 text-teal-600" />
        </div>
      </div>

      {/* Source / read-only note */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <p className="text-sm text-teal-900 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          Live mirror of your active Sweep&amp;Go customers — refreshes hourly. Read-only here; changes never affect Sweep&amp;Go.
          <span className="text-teal-700" suppressHydrationWarning>· last synced {fmtSynced(lastSyncedAt)}</span>
        </p>
        <Link href="/admin/customers/archived" className="text-sm font-medium text-teal-700 hover:underline flex items-center gap-1 flex-shrink-0">
          <Archive className="w-4 h-4" />
          Former customers ({archivedCount})
        </Link>
      </div>

      {/* Search + sort */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text" name="search" defaultValue={search}
              placeholder="Search by name, address, zip, phone, or email…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <select
            name="sort" defaultValue={`${sort}:${dir}`}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="start:asc">Start date (oldest first)</option>
            <option value="start:desc">Start date (newest first)</option>
            <option value="address:asc">Address (A–Z)</option>
            <option value="subscription:asc">Subscription</option>
            <option value="serviceDay:asc">Service day</option>
            <option value="frequency:asc">Frequency</option>
            <option value="tech:asc">Tech</option>
            <option value="review:asc">Review status</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm">Apply</button>
        </form>
        <p className="text-xs text-gray-400 mt-2">Tip: click a column header to sort, or use the dropdown. Sort by <strong>Start date (oldest first)</strong> for your longest-standing customers.</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {renderTh("Customer", "name")}
                {renderTh("Start Date", "start")}
                {renderTh("Address", "address")}
                {renderTh("Phone")}
                {renderTh("Subscription", "subscription")}
                {renderTh("Service Day", "serviceDay")}
                {renderTh("Frequency", "frequency")}
                {renderTh("Tech", "tech")}
                {renderTh("Review", "review")}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    {search ? "No customers match your search." : "No customers synced yet — the hourly sync will populate this list."}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-navy-900 hover:text-teal-600 hover:underline">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
                      </Link>
                      {c.email && <div className="text-sm text-gray-500">{c.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap" suppressHydrationWarning>{fmtDate(c.startDate ?? c.firstSeenAt)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-navy-900">{c.address || "-"}</div>
                      <div className="text-sm text-gray-500">{c.zipCode || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-navy-900 whitespace-nowrap">
                      {fmtPhone(c.cellPhone) ? <a href={`tel:${c.cellPhone}`} className="hover:text-teal-600">{fmtPhone(c.cellPhone)}</a> : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.subscriptionNames || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{c.serviceDays || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.cleanupFrequency || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{c.assignedTo || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CustomerReviewControl customerId={c.id} value={c.reviewStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
