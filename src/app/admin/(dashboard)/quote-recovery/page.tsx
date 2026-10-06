import Link from "next/link";
import { Zap, Link2 } from "lucide-react";
import prisma from "@/lib/prisma";
import { PageHero, heroBtnPrimary, heroBtnSecondary, heroPrimaryStyle } from "@/components/admin/PageHero";
import { SettingsGroupCard, type GroupDef } from "@/components/admin/settings/SettingsGroupCard";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { recoverySettings, recoveryStats, recoveryStatus, RECOVERY_LABEL, SNG_QUOTE_WHERE, type RecoveryStatus } from "@/lib/quote-recovery";
import { loadSendWindow } from "@/lib/send-window";

export const dynamic = "force-dynamic";

// Quote recovery: Sweep&Go quotes that never became signups, their resume links,
// the settings behind them, and how many came back.

const RECOVERY_GROUP: GroupDef = {
  id: "recovery", title: "Quote recovery settings", prefix: "recovery.",
  description: "How abandoned quotes are detected and what the resume links carry. The resume page on doogoodscoopers.com reads these live.",
  fields: [
    { key: "recovery.abandonMinutes", label: "Mark a quote abandoned after (minutes)", type: "number", min: 1, max: 10080, placeholder: "30", hint: "No signup after this long = abandoned. Recovery campaigns enroll people at this moment." },
    { key: "recovery.linkExpiryDays", label: "Resume links expire after (days since last activity)", type: "number", min: 0, max: 365, placeholder: "30", hint: "0 = never expire." },
    { key: "recovery.coupon", label: "Recovery coupon code", type: "text", placeholder: "WELCOME25", hint: "Applied on every resume link and available in messages as {{coupon}}. Create the code in Sweep&Go." },
    { key: "recovery.resumeBase", label: "Resume page link (code is added to the end)", type: "url", placeholder: "https://doogoodscoopers.com/r/?c=" },
    { key: "recovery.scheduleUrl", label: "Schedule page (where the resume page sends people)", type: "url", placeholder: "https://doogoodscoopers.com/schedule-service/" },
    { key: "recovery.quoteUrl", label: "Quote page (fallback for expired links)", type: "url", placeholder: "https://doogoodscoopers.com/get-a-quote/" },
  ],
};

const statusStyle: Record<RecoveryStatus, string> = {
  quoted: "bg-blue-100 text-blue-800", abandoned: "bg-amber-100 text-amber-800", returned: "bg-violet-100 text-violet-800",
  signed_up: "bg-green-100 text-green-800", archived: "bg-gray-100 text-gray-600",
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function fmt(d: Date | null, timeZone: string) {
  return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }) : "—";
}

export default async function QuoteRecoveryPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: d } = await searchParams;
  const days = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const settings = await recoverySettings();
  const { timeZone } = await loadSendWindow();
  const [stats, leads, campaigns] = await Promise.all([
    recoveryStats(days, settings),
    prisma.quoteLead.findMany({ where: { ...SNG_QUOTE_WHERE, createdAt: { gte: daysAgo(days) } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.campaign.findMany({ where: { type: "DRIP" }, select: { id: true, name: true, active: true, status: true, audienceFilter: true } }),
  ]);
  const recoveryCampaigns = campaigns.filter((c) => (((c.audienceFilter || {}) as { leadTypes?: string[] }).leadTypes || []).includes("abandoned_quotes"));
  const pct = stats.recoveryRate == null ? "—" : `${Math.round(stats.recoveryRate * 100)}%`;
  const channel = (k: string) => (k === "sms" ? "text" : k === "email" ? "email" : "other");

  const tile = (label: string, value: string | number, sub?: string) => (
    <div className="dgs-card p-4">
      <p className="text-2xl font-bold text-navy-900 leading-none tabular-nums">{value}</p>
      <p className="text-xs text-gray-600 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <PageHero
        title="Quote recovery"
        subtitle="Sweep&Go quotes that never became signups, and the personal resume links that bring people back."
        actions={
          <>
            {[7, 30, 90].map((n) => (
              <Link key={n} href={`/admin/quote-recovery?days=${n}`} className={heroBtnSecondary} style={n === days ? { outline: "2px solid rgba(255,255,255,.6)" } : undefined}>
                {n} days
              </Link>
            ))}
            <Link href="/admin/campaigns/new-drip?audience=abandoned_quotes" className={heroBtnPrimary} style={heroPrimaryStyle}>
              <Zap className="w-4 h-4" />
              New recovery campaign
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tile("quotes started", stats.started, `last ${days} days`)}
        {tile("signed up", stats.signedUp)}
        {tile("abandoned", stats.abandoned, `no signup within ${settings.abandonMinutes} min`)}
        {tile("returned", stats.returned, "opened their resume link")}
        {tile("recovered", stats.recovered, "signed up after returning")}
        {tile("recovery rate", pct, Object.keys(stats.byChannel).length ? Object.entries(stats.byChannel).map(([k, v]) => `${v} via ${channel(k)}`).join(" · ") : undefined)}
      </div>

      <div className="dgs-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-lg font-semibold text-navy-900">Recovery campaigns</h2>
          <Link href="/admin/campaigns" className="text-sm text-teal-700 hover:underline">All campaigns →</Link>
        </div>
        {recoveryCampaigns.length === 0 ? (
          <p className="text-sm text-gray-600">
            No campaign targets abandoned quotes yet. Create one with the <b>Abandoned quotes</b> audience and load the starter sequence (email after 1 hour, text after 1 day). Reminders stop on their own when the person signs up.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 text-sm">
            {recoveryCampaigns.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <Link href={`/admin/campaigns/${c.id}`} className="text-navy-900 hover:text-teal-600 hover:underline flex-1 min-w-0 truncate">{c.name}</Link>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.status === "DRAFT" ? "bg-amber-100 text-amber-800" : c.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {c.status === "DRAFT" ? "Draft" : c.active ? "Active" : "Paused"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dgs-card p-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-1">Quotes (last {days} days)</h2>
        <p className="text-xs text-gray-500 mb-4">Each person&apos;s resume link opens the website&apos;s resume page, then the schedule page with their answers filled in and their Sweep&amp;Go quote attached.</p>
        {leads.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No Sweep&amp;Go quotes in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Quote</th>
                  <th className="pb-2 pr-4 font-medium">Quoted</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Link opened</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((l) => {
                  const st = recoveryStatus(l, settings);
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-4">
                        <Link href={`/admin/quote-leads/${l.id}`} className="text-navy-900 hover:text-teal-600 hover:underline">{[l.firstName, l.lastName].filter(Boolean).join(" ") || "Unknown"}</Link>
                        {l.marketingAllowed === false && <span className="block text-[11px] text-gray-400">no text consent box</span>}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{[l.numberOfDogs ? `${l.numberOfDogs} dog${l.numberOfDogs === "1" ? "" : "s"}` : null, l.frequency?.replace(/_/g, " "), l.zipCode].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-2 pr-4 text-gray-500 whitespace-nowrap" suppressHydrationWarning>{fmt(l.createdAt, timeZone)}</td>
                      <td className="py-2 pr-4"><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyle[st]}`}>{RECOVERY_LABEL[st]}</span></td>
                      <td className="py-2 pr-4 text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                        {l.resumeOpenedAt ? `${fmt(l.resumeOpenedAt, timeZone)}${l.resumeOpenCount > 1 ? ` (×${l.resumeOpenCount})` : ""}${l.resumeChannel ? ` · ${channel(l.resumeChannel)}` : ""}` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {l.resumeCode && !l.resumeDisabled && st !== "signed_up" ? (
                          <CopyLinkButton link={`${settings.resumeBase}${l.resumeCode}`} label="Copy link" />
                        ) : l.resumeDisabled ? <span className="text-xs text-gray-400">link disabled</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SettingsGroupCard group={RECOVERY_GROUP} />

      <div className="dgs-card p-6 text-sm text-gray-600 space-y-1">
        <p className="flex items-center gap-2 text-navy-900 font-medium"><Link2 className="w-4 h-4 text-teal-600" /> How a resume link works</p>
        <p>The link in a message goes to the resume page on doogoodscoopers.com. That page asks this app for the person&apos;s answers, shows &ldquo;Welcome back&rdquo;, and sends them to the schedule page with everything filled in and their original Sweep&amp;Go quote attached, so the signup finishes that quote instead of creating a duplicate. Expired or disabled links send people to a fresh quote.</p>
      </div>
    </div>
  );
}
