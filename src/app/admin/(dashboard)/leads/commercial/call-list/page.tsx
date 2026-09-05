import Link from "next/link";
import { PhoneCall, Search, Filter, Archive, Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import { PageHero, heroBtnSecondary, heroBtnPrimary, heroPrimaryStyle } from "@/components/admin/PageHero";
import { LeadsSectionSwitch } from "@/components/admin/LeadsSectionSwitch";
import { ProspectRowActions } from "@/components/admin/ProspectRowActions";
import { ProspectCsvUpload } from "@/components/admin/ProspectCsvUpload";
import { PROSPECT_TYPES, PROSPECT_TYPE_LABEL, type ProspectType } from "@/lib/commercial-prospects";

export const dynamic = "force-dynamic";
interface PageProps { searchParams: Promise<{ status?: string; type?: string; search?: string; page?: string; archived?: string }>; }

const STATUS_BADGE: Record<string, [string, string]> = {
  TO_CALL: ["To call", "bg-teal-100 text-teal-800"], ATTEMPTED: ["Attempted", "bg-blue-100 text-blue-800"],
  CONVERTED: ["Converted", "bg-green-100 text-green-800"], ARCHIVED: ["Archived", "bg-gray-100 text-gray-800"],
};
const TYPE_BADGE: Record<string, string> = { HOA: "bg-violet-100 text-violet-800", APARTMENTS: "bg-amber-100 text-amber-800", SENIOR_55: "bg-sky-100 text-sky-800", OTHER: "bg-gray-100 text-gray-700" };
const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export default async function CallListPage({ searchParams }: PageProps) {
  const p = await searchParams; const showArchived = p.archived === "true"; const pageSize = 25; const page = p.page ? parseInt(p.page) : 1;
  const where: Record<string, unknown> = showArchived ? { status: "ARCHIVED" } : (p.status && p.status !== "all" ? { status: p.status } : { status: { in: ["TO_CALL", "ATTEMPTED", "CONVERTED"] } });
  if (p.type && p.type !== "all") where.propertyType = p.type;
  if (p.search) where.OR = ["propertyName", "contactName", "email", "phone", "city", "zipCode", "address", "notes"].map((k) => ({ [k]: { contains: p.search, mode: "insensitive" } }));
  const [rows, total, counts] = await Promise.all([
    prisma.commercialProspect.findMany({ where, orderBy: [{ status: "asc" }, { lastAttemptAt: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.commercialProspect.count({ where }),
    prisma.commercialProspect.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all])); const totalPages = Math.ceil(total / pageSize);
  const qs = (over: Record<string, string>) => { const u = new URLSearchParams({ ...(p.status ? { status: p.status } : {}), ...(p.type ? { type: p.type } : {}), ...(p.search ? { search: p.search } : {}), ...(showArchived ? { archived: "true" } : {}), ...over }); return `/admin/leads/commercial/call-list?${u}`; };

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title={showArchived ? "Archived Prospects" : "Call List"}
        subtitle={showArchived ? `${total} archived` : `${c.TO_CALL || 0} to call · ${c.ATTEMPTED || 0} attempted · ${c.CONVERTED || 0} converted`}
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#9BE7C0,#12A150)" }}><PhoneCall className="w-[22px] h-[22px] text-white" /></div>}
        actions={<>
          <LeadsSectionSwitch active="callList" />
          <Link href="/admin/leads/commercial/call-list/new" className={heroBtnPrimary} style={heroPrimaryStyle}><Plus className="w-4 h-4" /><span className="hidden sm:inline">Add prospect</span></Link>
          <ProspectCsvUpload />
          <Link href={showArchived ? "/admin/leads/commercial/call-list" : "/admin/leads/commercial/call-list?archived=true"} className={heroBtnSecondary}><Archive className="w-4 h-4" />{showArchived ? "View Active" : "View Archived"}</Link>
        </>}
      />
      <div className="dgs-card p-4">
        <form className="flex flex-col sm:flex-row gap-4">
          {showArchived && <input type="hidden" name="archived" value="true" />}
          <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" name="search" defaultValue={p.search} placeholder="Search by property, contact, phone, city, ZIP, or notes..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" /></div>
          <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select name="type" defaultValue={p.type || "all"} className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none bg-white">
              <option value="all">All Types</option>{PROSPECT_TYPES.map((t) => <option key={t} value={t}>{PROSPECT_TYPE_LABEL[t]}</option>)}</select></div>
          {!showArchived && <select name="status" defaultValue={p.status || "all"} className="px-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none bg-white">
            <option value="all">Active</option><option value="TO_CALL">To call</option><option value="ATTEMPTED">Attempted</option><option value="CONVERTED">Converted</option></select>}
          <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">Apply</button>
        </form>
      </div>
      <div className="dgs-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100"><tr>
          {["Property", "Contact", "Location", "Calls", "Status", "Actions"].map((h) => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">{showArchived ? "Nothing archived" : "The call list is empty — upload a CSV or Excel file, or add a prospect"}</td></tr> : rows.map((r) => {
            const [sl, sc] = STATUS_BADGE[r.status] || [r.status, "bg-gray-100 text-gray-800"];
            return (<tr key={r.id} className="hover:bg-gray-50 transition-colors align-top">
              <td className="px-6 py-4"><Link href={`/admin/leads/commercial/call-list/${r.id}`} className="font-semibold text-navy-900 hover:text-teal-700 hover:underline">{r.propertyName}</Link>
                <p className="mt-1 flex items-center gap-2 flex-wrap"><span className={`px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${TYPE_BADGE[r.propertyType] || TYPE_BADGE.OTHER}`}>{PROSPECT_TYPE_LABEL[r.propertyType as ProspectType] || r.propertyType}</span>{r.units ? <span className="text-xs text-gray-500">{r.units} units</span> : null}</p>
                {r.notes ? <p className="text-xs text-gray-500 mt-1 whitespace-pre-line line-clamp-3 max-w-md">{r.notes}</p> : null}</td>
              <td className="px-6 py-4 text-sm"><p className="text-navy-900">{r.contactName || <span className="text-gray-400">—</span>}</p>
                {r.phone && <p><a href={`tel:${r.phone.replace(/\D/g, "")}`} className="text-teal-700 hover:underline">{r.phone}</a></p>}
                {r.email && <p><a href={`mailto:${r.email}`} className="text-teal-700 hover:underline break-all">{r.email}</a></p>}</td>
              <td className="px-6 py-4 text-sm text-navy-900">{r.address && <p className="text-gray-600">{r.address}</p>}<p>{r.city}, {r.state} {r.zipCode}</p></td>
              <td className="px-6 py-4 text-sm text-navy-900"><p>{r.attempts}</p><p className="text-xs text-gray-500">last {fmt(r.lastAttemptAt)}</p></td>
              <td className="px-6 py-4"><span className={`inline-block px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${sc}`}>{sl}</span>
                {r.status === "CONVERTED" && r.convertedLeadId && <p className="mt-1"><Link href={`/admin/leads/commercial/${r.convertedLeadId}`} className="text-xs text-teal-700 hover:underline">Open lead →</Link></p>}</td>
              <td className="px-6 py-4"><ProspectRowActions id={r.id} status={r.status} hasContact={!!(r.phone || r.email)} showView /></td>
            </tr>);
          })}
        </tbody></table></div>
        {totalPages > 1 && <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-600">
          <span>Page {page} of {totalPages} · {total} total</span>
          <span className="flex gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Previous</Link>}{page < totalPages && <Link href={qs({ page: String(page + 1) })} className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Next</Link>}</span>
        </div>}
      </div>
    </div>
  );
}
