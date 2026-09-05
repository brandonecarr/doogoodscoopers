import prisma from "@/lib/prisma";
import { getSetting } from "@/lib/google-business";

/**
 * One row per integration: is it configured, and where is it managed?
 * Only presence of environment variables is reported — never their values.
 */
export interface IntegrationStatus { name: string; group: string; ok: boolean; detail: string; manageHref?: string; manageLabel?: string; env: string[] }
const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);
const missing = (...keys: string[]) => keys.filter((k) => !process.env[k]);

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const [fbPage, fbPageName, googleEmail, googleTitle] = await Promise.all([
    getSetting("facebook.pageToken"), getSetting("facebook.pageName"), getSetting("google.bp.connectedEmail"), getSetting("google.bp.locationTitle"),
  ]);
  const rows: IntegrationStatus[] = [
    { name: "Sweep&Go", group: "Core", env: ["SWEEPANDGO_API_TOKEN", "SWEEPANDGO_WEBHOOK_SECRET"], ok: has("SWEEPANDGO_API_TOKEN"), detail: has("SWEEPANDGO_API_TOKEN") ? (has("SWEEPANDGO_WEBHOOK_SECRET") ? "API + webhook secret set" : "API set; webhook secret missing") : "API token missing", manageHref: "/admin/customers", manageLabel: "Customers" },
    { name: "Quo (SMS + calls)", group: "Core", env: ["QUO_API_KEY", "QUO_PHONE_NUMBER", "QUO_WEBHOOK_SECRET"], ok: has("QUO_API_KEY", "QUO_PHONE_NUMBER"), detail: has("QUO_API_KEY", "QUO_PHONE_NUMBER") ? "Ready" : `Missing ${missing("QUO_API_KEY", "QUO_PHONE_NUMBER").join(", ")}`, manageHref: "/admin/campaigns", manageLabel: "Campaigns" },
    { name: "Resend (email)", group: "Core", env: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], ok: has("RESEND_API_KEY"), detail: has("RESEND_API_KEY") ? "Ready" : "API key missing", manageHref: "/admin/email", manageLabel: "Email" },
    { name: "Brevo (canvasser invites)", group: "Core", env: ["BREVO_API_KEY"], ok: has("BREVO_API_KEY"), detail: has("BREVO_API_KEY") ? "Ready" : "API key missing" },
    { name: "Web push notifications", group: "Core", env: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"], ok: has("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"), detail: has("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY") ? "Ready" : "VAPID keys missing" },
    { name: "Cron jobs", group: "Core", env: ["CRON_SECRET"], ok: has("CRON_SECRET"), detail: has("CRON_SECRET") ? "Secret set" : "CRON_SECRET missing — scheduled jobs will be rejected" },
    { name: "Facebook Page (Messenger)", group: "Meta", env: ["FB_APP_SECRET", "FB_APP_ID"], ok: !!fbPage && has("FB_APP_SECRET"), detail: fbPage ? `Connected: ${fbPageName || "Page"}` : has("FB_APP_SECRET") ? "App secret set; no Page connected" : "FB_APP_SECRET missing", manageHref: "/admin/messenger", manageLabel: "Messenger" },
    { name: "Instagram auto-DM", group: "Meta", env: ["IG_PAGE_TOKEN", "IG_ACCOUNT_ID", "IG_VERIFY_TOKEN", "META_APP_SECRET"], ok: has("IG_PAGE_TOKEN", "IG_ACCOUNT_ID", "IG_VERIFY_TOKEN"), detail: has("IG_PAGE_TOKEN", "IG_ACCOUNT_ID", "IG_VERIFY_TOKEN") ? "Ready" : `Missing ${missing("IG_PAGE_TOKEN", "IG_ACCOUNT_ID", "IG_VERIFY_TOKEN").join(", ")}`, manageHref: "/admin/instagram", manageLabel: "Instagram" },
    { name: "Meta Pixel + Conversions API", group: "Meta", env: ["META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"], ok: has("META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"), detail: has("META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN") ? "Ready" : `Missing ${missing("META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN").join(", ")}` },
    { name: "Google Business Profile", group: "Google", env: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"], ok: !!googleEmail, detail: googleEmail ? `Connected as ${googleEmail}${googleTitle ? ` · ${googleTitle}` : ""}` : has("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET") ? "OAuth configured; not connected" : "OAuth client missing", manageHref: "/admin/reviews", manageLabel: "Reviews" },
    { name: "Google Maps / Places", group: "Google", env: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_SERVER_API_KEY"], ok: has("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"), detail: has("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") ? "Ready" : "Browser key missing" },
    { name: "Mapbox (maps, geocoding)", group: "Google", env: ["NEXT_PUBLIC_MAPBOX_TOKEN", "MAPBOX_TOKEN"], ok: has("NEXT_PUBLIC_MAPBOX_TOKEN"), detail: has("NEXT_PUBLIC_MAPBOX_TOKEN") ? "Ready" : "NEXT_PUBLIC_MAPBOX_TOKEN missing", manageHref: "/admin/leads?view=map", manageLabel: "Leads map" },
    { name: "Anthropic (Claude)", group: "AI", env: ["ANTHROPIC_API_KEY"], ok: has("ANTHROPIC_API_KEY"), detail: has("ANTHROPIC_API_KEY") ? "Ready — Ask DGS, Marketing director, call notes" : "API key missing", manageHref: "/admin/ask", manageLabel: "Ask DGS" },
    { name: "OpenAI", group: "AI", env: ["OPENAI_API_KEY"], ok: has("OPENAI_API_KEY"), detail: has("OPENAI_API_KEY") ? "Ready" : "Not set (optional)" },
    { name: "Stripe", group: "Billing", env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], ok: has("STRIPE_SECRET_KEY"), detail: has("STRIPE_SECRET_KEY") ? (has("STRIPE_WEBHOOK_SECRET") ? "Ready" : "Key set; webhook secret missing") : "Not set" },
    { name: "Website form webhooks", group: "Website", env: ["COMMERCIAL_WEBHOOK_SECRET", "CAREERS_WEBHOOK_SECRET", "ZAPIER_WEBHOOK_SECRET"], ok: true, detail: `Secrets set: ${["COMMERCIAL_WEBHOOK_SECRET", "CAREERS_WEBHOOK_SECRET", "ZAPIER_WEBHOOK_SECRET"].filter((k) => !!process.env[k]).length} of 3 (optional)` },
    { name: "Local rank grid (Scrappa)", group: "Website", env: ["SCRAPPA_API_KEY"], ok: has("SCRAPPA_API_KEY"), detail: has("SCRAPPA_API_KEY") ? "Ready" : "API key missing", manageHref: "/admin/rank-grid", manageLabel: "Rank Grid" },
  ];
  return rows;
}

export async function getSystemCounts() {
  const [admins, canvassers, quoteLeads, adLeads, commercial, prospects, customers, campaigns, templates, notifications] = await Promise.all([
    prisma.adminUser.count(), prisma.canvasser.count(), prisma.quoteLead.count(), prisma.adLead.count(), prisma.commercialLead.count(), prisma.commercialProspect.count(),
    prisma.sweepandgoCustomer.count({ where: { active: true } }).catch(() => 0), prisma.campaign.count(), prisma.messageTemplate.count(), prisma.adminNotification.count().catch(() => 0),
  ]);
  return { admins, canvassers, quoteLeads, adLeads, commercial, prospects, customers, campaigns, templates, notifications };
}
