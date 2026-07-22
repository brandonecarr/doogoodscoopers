import Link from "next/link";
import { ArrowLeft, Archive, Search } from "lucide-react";
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

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ArchivedCustomersPage({ searchParams }: PageProps) {
  const { search } = await searchParams;

  const where: Record<string, unknown> = { active: false };
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

  const customers = await prisma.sweepandgoCustomer.findMany({
    where,
    orderBy: { removedAt: "desc" },
  });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">Former Customers</h1>
          <p className="text-navy-600 mt-1">{customers.length} customers no longer active in Sweep&amp;Go</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <Archive className="w-6 h-6 text-gray-500" />
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-600">
          These customers dropped off your active Sweep&amp;Go list and were archived automatically. If one becomes active
          again in Sweep&amp;Go, they&apos;ll move back to your Customers list on the next sync. Great candidates for a win-back campaign.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search former customers…"
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
                {["Customer", "Address", "Phone", "Last Subscription", "Archived"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {search ? "No former customers match your search." : "No former customers yet."}
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
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap" suppressHydrationWarning>{fmtDate(c.removedAt)}</td>
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
