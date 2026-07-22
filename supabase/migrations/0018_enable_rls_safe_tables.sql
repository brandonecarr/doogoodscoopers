-- Security hardening: enable Row Level Security on tables that are ONLY ever
-- accessed server-side via Prisma (role: postgres, BYPASSRLS) or the Supabase
-- service-role client (BYPASSRLS). Enabling RLS with no policy denies the public
-- `anon`/`authenticated` PostgREST roles while leaving app access unaffected.
--
-- Deliberately EXCLUDED here (they ARE reached with the anon/authenticated role —
-- public quote form, onboarding, login, client portal — and need real policies):
--   users, organizations, clients, dogs, locations, subscriptions, invoices,
--   account_credits, referrals, referral_rewards, referral_program_settings,
--   gift_certificates, gift_certificate_redemptions, pricing_rules, service_plans,
--   coupons, add_ons, subscription_add_ons, zip_frequency_restrictions,
--   onboarding_sessions, onboarding_events, leads.

-- Admin / CRM (Prisma-owned, server-only)
ALTER TABLE "public"."ActivityLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminUser"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminPushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MessageTemplate"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadMessage"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadUpdate"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Campaign"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CampaignRecipient"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CampaignStep"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SmsOptOut"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SweepandgoCustomer"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Review"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AppSetting"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuoteLead"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OutOfAreaLead"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CareerApplication"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CommercialLead"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdLead"              ENABLE ROW LEVEL SECURITY;

-- Office / field / billing / messaging (service-role only)
ALTER TABLE "public"."staff_profiles"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."jobs"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."job_add_ons"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."routes"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."route_stops"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shifts"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shift_breaks"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoice_items"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_card_links"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."client_contacts"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."message_conversations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inbound_messages"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reply_forwarding_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."marketing_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."marketing_sync_events"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhooks"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_deliveries"     ENABLE ROW LEVEL SECURITY;

-- Already has a "Public can read metrics" policy — enabling RLS activates it
-- (public read still works, but writes are now locked to service-role).
ALTER TABLE "public"."public_metrics_cache"   ENABLE ROW LEVEL SECURITY;

-- Pin function search_path (was role-mutable). These reference public.* and the
-- schema-qualified auth.uid(), so `public` is sufficient and non-breaking.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.get_user_org_id()          SET search_path = public;
ALTER FUNCTION public.get_user_role()            SET search_path = public;
