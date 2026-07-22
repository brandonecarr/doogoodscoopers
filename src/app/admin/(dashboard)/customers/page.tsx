import Link from "next/link";
import { Dog, Search, Archive, RefreshCw } from "lucide-react";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string }>;
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

export default async function CustomersPage({ searchParams }: PageProps) {
  const { search } = await searchParams;

  const where: Record<string, unknown> = { active: true };
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
    prisma.sweepandgoCustomer.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.sweepandgoCustomer.count({ where: { active: true } }),
    prisma.sweepandgoCustomer.count({ where: { active: false } }),
    prisma.sweepandgoCustomer.aggregate({ _max: { lastSyncedAt: true } }),
  ]);

  const lastSyncedAt = lastSync._max.lastSyncedAt;

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
        <Link
          href="/admin/customers/archived"
          className="text-sm font-medium text-teal-700 hover:underline flex items-center gap-1 flex-shrink-0"
        >
          <Archive className="w-4 h-4" />
          Former customers ({archivedCount})
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by name, address, zip, phone, or email…"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Customer", "Address", "Phone", "Subscription", "Service Day", "Frequency", "Tech"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {search ? "No customers match your search." : "No customers synced yet — the hourly sync will populate this list."}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
                      </div>
                      {c.email && <div className="text-sm text-gray-500">{c.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-navy-900">{c.address || "-"}</div>
                      <div className="text-sm text-gray-500">{c.zipCode || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-navy-900 whitespace-nowrap">
                      {fmtPhone(c.cellPhone) ? (
                        <a href={`tel:${c.cellPhone}`} className="hover:text-teal-600">{fmtPhone(c.cellPhone)}</a>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.subscriptionNames || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{c.serviceDays || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.cleanupFrequency || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{c.assignedTo || "-"}</td>
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
