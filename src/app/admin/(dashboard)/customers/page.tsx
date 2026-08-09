import Link from "next/link";
import { Search, Archive, RefreshCw, ArrowUp, ArrowDown, LayoutList, Map as MapIcon, CalendarRange } from "lucide-react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { CustomerReviewControl } from "@/components/admin/CustomerReviewControl";
import { CustomersMapClient } from "@/components/admin/CustomersMapClient";
import { RoutePlannerClient } from "@/components/admin/RoutePlannerClient";
import type { MapCustomer } from "@/components/admin/CustomerInfoPanels";
import { geocodeAddress, resolveZips, normalizeZip } from "@/lib/geo/zipgeo";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; sort?: string; dir?: string; view?: string }>;
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

const SORTS: Record<string, (dir: "asc" | "desc") => Prisma.SweepandgoCustomerOrderByWithRelationInput[]> = {
  name:         (d) => [{ lastName: d }, { firstName: d }],
  start:        (d) => [{ startDate: d }, { firstSeenAt: d }],
  address:      (d) => [{ address: d }],
  subscription: (d) => [{ subscriptionNames: d }],
  serviceDay:   (d) => [{ serviceDays: d }],
  frequency:    (d) => [{ cleanupFrequency: d }],
  dogs:         (d) => [{ numberOfDogs: d }],
  tech:         (d) => [{ assignedTo: d }],
  review:       (d) => [{ reviewStatus: d }],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cust = any;

export default async function CustomersPage({ searchParams }: PageProps) {
  const { search, sort: sortRaw, dir: dirRaw, view: viewRaw } = await searchParams;
  const view = viewRaw === "map" ? "map" : viewRaw === "planner" ? "planner" : "list";
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

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // ── Map + Planner views: geocode any missing coords + build the pin data ───
  let mapCustomers: MapCustomer[] = [];
  let uncoded = 0;
  if (view === "map" || view === "planner") {
    const missing = customers.filter((c: Cust) => c.lat == null || c.lng == null).slice(0, 60);
    // Bounded parallel geocode so first load isn't slow.
    for (let i = 0; i < missing.length; i += 8) {
      const chunk = missing.slice(i, i + 8);
      await Promise.all(chunk.map(async (c: Cust) => {
        const p = await geocodeAddress(c.address, c.zipCode);
        if (p) { c.lat = p.lat; c.lng = p.lng; await prisma.sweepandgoCustomer.update({ where: { id: c.id }, data: { lat: p.lat, lng: p.lng } }).catch(() => {}); }
      }));
    }
    const zips = [...new Set(customers.map((c: Cust) => normalizeZip(c.zipCode)).filter(Boolean) as string[])];
    const zipMap = zips.length ? await resolveZips(zips) : new Map();
    const located = customers.filter((c: Cust) => c.lat != null && c.lng != null);
    uncoded = customers.length - located.length;
    mapCustomers = located.map((c: Cust) => {
      const zip5 = normalizeZip(c.zipCode);
      const place = zip5 ? zipMap.get(zip5)?.place || "" : "";
      const city = place.split(",")[0]?.trim();
      return {
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Customer",
        firstName: c.firstName || "",
        address: c.address || "",
        cityLine: city ? `${city}, CA ${zip5}` : zip5 ? `CA ${zip5}` : "",
        zipCode: zip5 || "",
        lat: c.lat, lng: c.lng,
        phone: c.cellPhone || c.homePhone || "",
        email: c.email || "",
        numberOfDogs: c.numberOfDogs,
        cleanupFrequency: c.cleanupFrequency || "",
        serviceDays: c.serviceDays || "",
        subscriptionNames: c.subscriptionNames || "",
        assignedTo: c.assignedTo || "",
        startDate: (c.startDate ?? c.firstSeenAt)?.toISOString() ?? null,
        oneTimeClient: c.oneTimeClient,
      };
    });
  }

  // Planner: current day-assignments (a read-only scratchpad in its own table,
  // entirely separate from Sweep&Go).
  const planAssignments: Record<string, number> = {};
  if (view === "planner") {
    const rows = await prisma.routePlanAssignment.findMany({ select: { customerId: true, dayOfWeek: true } });
    for (const r of rows) planAssignments[r.customerId] = r.dayOfWeek;
  }

  // Link helpers that preserve current filters.
  const qs = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    return `/admin/customers?${p}`;
  };
  const viewHref = (v: string) => qs({ view: v === "list" ? undefined : v, sort: sortRaw, dir: dirRaw });
  const renderTh = (label: string, sortKey?: string) => {
    if (!sortKey) return <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{label}</th>;
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

  const viewBtn = (v: string, label: string, Icon: typeof LayoutList) => (
    <Link href={viewHref(v)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[13px] font-semibold transition-colors ${view === v ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"}`}>
      <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
    </Link>
  );

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap px-1">
        <div>
          <h1 className="dgs-title">Customers</h1>
          <p className="dgs-sub">{totalActive} active Sweep&amp;Go customers</p>
        </div>
        <div className="flex items-center bg-white rounded-[12px] p-1 border border-hair">
          {viewBtn("list", "List", LayoutList)}
          {viewBtn("map", "Map", MapIcon)}
          {viewBtn("planner", "Planner", CalendarRange)}
        </div>
      </div>

      {/* Source / read-only note */}
      <div className="dgs-card p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between" style={{ background: "#F7F5FF" }}>
        <p className="text-[13px] text-bodytext flex items-center gap-2">
          <RefreshCw className="w-4 h-4 flex-shrink-0 text-iris-deep" />
          Live mirror of your active Sweep&amp;Go customers — refreshes hourly. Read-only here; changes never affect Sweep&amp;Go.
          <span className="text-muted" suppressHydrationWarning>· last synced {fmtSynced(lastSyncedAt)}</span>
        </p>
        <Link href="/admin/customers/archived" className="text-[13px] font-semibold text-iris-deep hover:underline flex items-center gap-1 flex-shrink-0">
          <Archive className="w-4 h-4" />
          Former customers ({archivedCount})
        </Link>
      </div>

      {/* Search + sort */}
      <div className="dgs-card p-4">
        <form className="flex flex-col sm:flex-row gap-3">
          {view !== "list" && <input type="hidden" name="view" value={view} />}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" name="search" defaultValue={search}
              placeholder="Search by name, address, zip, phone, or email…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-iris focus:border-transparent" />
          </div>
          {view === "list" && (
            <select name="sort" defaultValue={`${sort}:${dir}`} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-iris">
              <option value="name:asc">Name (A–Z)</option>
              <option value="name:desc">Name (Z–A)</option>
              <option value="start:asc">Start date (oldest first)</option>
              <option value="start:desc">Start date (newest first)</option>
              <option value="address:asc">Address (A–Z)</option>
              <option value="subscription:asc">Subscription</option>
              <option value="serviceDay:asc">Service day</option>
              <option value="frequency:asc">Frequency</option>
              <option value="tech:asc">Tech</option>
              <option value="dogs:desc">Dogs (most first)</option>
              <option value="review:asc">Review status</option>
            </select>
          )}
          <button type="submit" className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors" style={{ background: "#8B6BFF" }}>Apply</button>
        </form>
      </div>

      {/* ── PLANNER / MAP / LIST ────────────────────────────────────────────── */}
      {view === "planner" ? (
        <RoutePlannerClient customers={mapCustomers} token={token} initialAssignments={planAssignments} />
      ) : view === "map" ? (
        <CustomersMapClient customers={mapCustomers} token={token} uncoded={uncoded} />
      ) : (
        /* ── LIST (table) ─────────────────────────────────────────────────── */
        <div className="dgs-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FAFAFC] border-b border-hairline">
                <tr>
                  {renderTh("Customer", "name")}
                  {renderTh("Start Date", "start")}
                  {renderTh("Address", "address")}
                  {renderTh("Phone")}
                  {renderTh("Dogs", "dogs")}
                  {renderTh("Subscription", "subscription")}
                  {renderTh("Service Day", "serviceDay")}
                  {renderTh("Frequency", "frequency")}
                  {renderTh("Tech", "tech")}
                  {renderTh("Review", "review")}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">{search ? "No customers match your search." : "No customers synced yet — the hourly sync will populate this list."}</td></tr>
                ) : (
                  customers.map((c: Cust) => (
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
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{c.numberOfDogs != null ? `${c.numberOfDogs} ${c.numberOfDogs === 1 ? "dog" : "dogs"}` : "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.subscriptionNames || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{c.serviceDays || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.cleanupFrequency || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{c.assignedTo || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><CustomerReviewControl customerId={c.id} value={c.reviewStatus} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
