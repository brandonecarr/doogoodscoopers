-- Security hardening phase 2: after switching the public server routes
-- (submit-quote, get-pricing, check-zip, get-form-options, onboarding/*,
-- mark-abandoned) from the anon client to the service-role client, these tables
-- are no longer reached by the anon/authenticated role. Enable RLS to deny the
-- public PostgREST roles. Prisma (postgres) and service-role bypass RLS.
--
-- users:         keeps its existing "Users can view own record" SELECT policy
--                (used by middleware / useAuth / auth-supabase — own record only).
-- organizations: keeps its existing "Service role has full access" policy.

ALTER TABLE "public"."users"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clients"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dogs"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."locations"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscriptions"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoices"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_credits"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referrals"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_rewards"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_program_settings"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gift_certificates"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gift_certificate_redemptions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."onboarding_sessions"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."onboarding_events"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."leads"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pricing_rules"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_plans"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coupons"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."add_ons"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_add_ons"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."zip_frequency_restrictions"    ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper functions: no RLS policy references them and no app
-- code calls them, so remove public/anon/authenticated execute (keep service_role).
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role()   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_org_id() TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_user_role()   TO service_role;
