import Link from "next/link";
import { Settings, Check, AlertCircle, ExternalLink } from "lucide-react";
import { PageHero, heroBtnSecondary } from "@/components/admin/PageHero";
import { getIntegrationStatus, getSystemCounts } from "@/lib/system-status";
import { AdminUsersCard } from "@/components/admin/settings/AdminUsersCard";
import { CanvasserUsersCard } from "@/components/admin/settings/CanvasserUsersCard";
import { SettingsGroupCard, type GroupDef } from "@/components/admin/settings/SettingsGroupCard";
import { AllSettingsCard } from "@/components/admin/settings/AllSettingsCard";

export const dynamic = "force-dynamic";

/** Feature settings stored in AppSetting, grouped. Keys mirror what each feature reads. */
const GROUPS: GroupDef[] = [
  { id: "sending-hours", title: "Sending hours", description: "When drips and blasts are allowed to send. Outside the window, messages queue until it opens.", prefix: "drips.window.", manageHref: "/admin/campaigns", manageLabel: "Campaigns",
    fields: [{ key: "drips.window.enabled", label: "Restrict sending to a window", type: "boolean" }, { key: "drips.window.startHour", label: "Start hour (0–23)", type: "number", min: 0, max: 23 }, { key: "drips.window.endHour", label: "End hour (0–23)", type: "number", min: 0, max: 23 }, { key: "drips.window.timezone", label: "Timezone", type: "text", placeholder: "America/Los_Angeles" }] },
  { id: "messenger", title: "Messenger auto-greeting", description: "One instant reply the first time someone messages the Facebook Page.", prefix: "messenger.", manageHref: "/admin/messenger", manageLabel: "Messenger",
    fields: [{ key: "messenger.autoReplyEnabled", label: "Auto-greeting on", type: "boolean" }, { key: "messenger.autoReply", label: "Greeting text", type: "textarea", placeholder: "Leave blank for the default" }, { key: "messenger.greetEveryone", label: "Greet everyone (App Review / testing)", type: "boolean", hint: "Normally only matched ad/form leads are greeted. Turn off after Meta approval." }] },
  { id: "dunning", title: "Failed-payment recovery", description: "Automatic texts to customers with an unpaid Sweep&Go invoice.", prefix: "dunning.", manageHref: "/admin/campaigns", manageLabel: "Campaigns",
    fields: [{ key: "dunning.enabled", label: "Recovery texts on", type: "boolean" }, { key: "dunning.payLink", label: "Payment link", type: "url", placeholder: "https://…" }, { key: "dunning.lastRun", label: "Last run", type: "text", readonly: true }] },
  { id: "call-ai", title: "AI call notes", description: "After each Quo call, Claude reads the transcript and files what the caller said into the lead.", prefix: "calls.ai.", manageHref: "/admin/leads", manageLabel: "Leads",
    fields: [{ key: "calls.ai.enabled", label: "Take notes and fill blanks", type: "boolean" }, { key: "calls.ai.createLeads", label: "Create leads from unknown callers", type: "boolean" }] },
  { id: "reviews", title: "Review links", description: "Used on the Reviews page and inside review-request texts.", prefix: "reviews.", manageHref: "/admin/reviews", manageLabel: "Reviews",
    fields: [{ key: "reviews.google.url", label: "Google reviews link", type: "url" }, { key: "reviews.google.writeUrl", label: "Google \"leave a review\" link", type: "url", hint: "Google Business Profile → Ask for reviews." }, { key: "reviews.yelp.url", label: "Yelp reviews link", type: "url" }, { key: "reviews.yelp.notRecommendedUrl", label: "Yelp – Not Recommended link", type: "url" }] },
  { id: "facebook-login", title: "Facebook Login", description: "Only needed if Facebook rejects the login with an invalid-scopes error.", prefix: "facebook.loginConfigId", manageHref: "/admin/messenger", manageLabel: "Messenger",
    fields: [{ key: "facebook.loginConfigId", label: "Login for Business configuration ID", type: "text", placeholder: "Numbers only" }] },
];

/** Every admin area, so this page doubles as the map of the system. */
const AREAS: { name: string; href: string; what: string }[] = [
  { name: "Dashboard", href: "/admin", what: "Today at a glance" },
  { name: "Leads", href: "/admin/leads", what: "Residential, Commercial, Call List, pipeline board, map" },
  { name: "Customers", href: "/admin/customers", what: "Sweep&Go customers, route planner, growth dashboard" },
  { name: "Campaigns", href: "/admin/campaigns", what: "Blasts, drips, sending hours, failed-payment texts" },
  { name: "Templates", href: "/admin/templates", what: "Message templates" },
  { name: "Email", href: "/admin/email", what: "Email sending and unsubscribes" },
  { name: "Reviews", href: "/admin/reviews", what: "Google Business Profile connection and review requests" },
  { name: "Messenger", href: "/admin/messenger", what: "Facebook Page connection and auto-greeting" },
  { name: "Instagram Auto-DM", href: "/admin/instagram", what: "Comment-to-DM campaigns" },
  { name: "Marketing", href: "/admin/marketing", what: "Weekly AI marketing director" },
  { name: "Ask DGS", href: "/admin/ask", what: "Ask questions of live business data" },
  { name: "Profitability", href: "/admin/profitability", what: "Route and customer margins" },
  { name: "Local Rank Grid", href: "/admin/rank-grid", what: "Map-pack rankings by city" },
  { name: "Content Studio", href: "/admin/studio", what: "Instagram carousel builder" },
  { name: "Funnels", href: "/admin/funnels", what: "Lead funnel pages" },
  { name: "Community Quote", href: "/admin/community-quote", what: "HOA and condo pricing calculator" },
  { name: "Canvassers", href: "/admin/canvassers", what: "Territories, map, field team" },
  { name: "Out of Area", href: "/admin/out-of-area", what: "Leads outside the route" },
  { name: "Career Applications", href: "/admin/careers", what: "Hiring pipeline" },
];

export default async function SettingsPage() {
  const [integrations, counts] = await Promise.all([getIntegrationStatus(), getSystemCounts()]);
  const groups = [...new Set(integrations.map((i) => i.group))];
  const okCount = integrations.filter((i) => i.ok).length;
  const version = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  const NavLink = ({ id, label }: { id: string; label: string }) => <a href={`#${id}`} className={heroBtnSecondary}>{label}</a>;

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Settings"
        subtitle={`${counts.admins} admin${counts.admins === 1 ? "" : "s"} · ${counts.canvassers} canvasser${counts.canvassers === 1 ? "" : "s"} · ${okCount} of ${integrations.length} integrations ready${version ? ` · build ${version}` : ""}`}
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#C4B5FD,#6D3EF0)" }}><Settings className="w-[22px] h-[22px] text-white" /></div>}
        actions={<><NavLink id="users" label="Users" /><NavLink id="integrations" label="Integrations" /><NavLink id="features" label="Features" /><NavLink id="areas" label="All areas" /></>}
      />

      {/* System at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[["Active customers", counts.customers], ["Residential leads", counts.quoteLeads + counts.adLeads], ["Commercial leads", counts.commercial], ["Call-list prospects", counts.prospects], ["Campaigns", counts.campaigns]].map(([l, n]) => (
          <div key={String(l)} className="dgs-card p-4"><p className="text-xs text-gray-500">{l}</p><p className="text-2xl font-bold text-navy-900">{Number(n).toLocaleString()}</p></div>
        ))}
      </div>

      <AdminUsersCard />
      <CanvasserUsersCard />

      {/* Integrations */}
      <div className="dgs-card p-6" id="integrations">
        <h2 className="text-lg font-semibold text-navy-900">Integrations</h2>
        <p className="text-sm text-gray-500 mb-4">Keys and secrets live in Vercel environment variables and are never shown here. This checks that each one is present; connections made inside the app (Facebook, Google) show their live state.</p>
        {groups.map((g) => (
          <div key={g} className="mb-4 last:mb-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{g}</p>
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {integrations.filter((i) => i.group === g).map((i) => (
                <li key={i.name} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${i.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{i.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-navy-900">{i.name}</p><p className="text-xs text-gray-500 break-words">{i.detail}<span className="text-gray-400"> · {i.env.join(", ")}</span></p></div>
                  {i.manageHref && <Link href={i.manageHref} className="text-xs text-teal-700 hover:underline whitespace-nowrap inline-flex items-center gap-1">{i.manageLabel} <ExternalLink className="w-3 h-3" /></Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Feature settings */}
      <div id="features" className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {GROUPS.map((g) => <SettingsGroupCard key={g.id} group={g} />)}
      </div>

      {/* Directory */}
      <div className="dgs-card p-6" id="areas">
        <h2 className="text-lg font-semibold text-navy-900 mb-1">All areas</h2>
        <p className="text-sm text-gray-500 mb-4">Everything the system does, in one list.</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {AREAS.map((a) => <li key={a.href}><Link href={a.href} className="block p-3 rounded-lg border border-gray-100 hover:border-teal-300 hover:bg-teal-50/40 transition-colors"><p className="text-sm font-semibold text-navy-900">{a.name}</p><p className="text-xs text-gray-500">{a.what}</p></Link></li>)}
        </ul>
      </div>

      <AllSettingsCard />
    </div>
  );
}
