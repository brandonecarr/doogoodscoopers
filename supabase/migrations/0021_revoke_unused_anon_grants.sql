-- Defense in depth for the browser-facing Postgres roles.
--
-- Every public table already has RLS enabled with no policies, which denies
-- anon/authenticated outright. But those roles still held table GRANTs on all
-- 588 public-schema privileges, so RLS was the *only* thing between them and
-- the data: if RLS were ever switched off on a table (a migration, a
-- `prisma db push`, a toggle in the Supabase UI) that table would become
-- readable immediately.
--
-- Removing the grants adds a second, independent lock. Nothing in the app is
-- affected:
--   * Prisma connects as `postgres` (BYPASSRLS) and is untouched.
--   * `service_role` keeps its grants — BYPASSRLS does NOT bypass GRANTs, so
--     revoking from it would break the public API routes.
--   * The only public table read by a logged-in user is `users` (own record,
--     guarded by the "Users can view own record" policy), re-granted below.

REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- The one grant the app actually uses.
GRANT SELECT ON public.users TO authenticated;

-- Stop future tables from silently re-granting to these roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
