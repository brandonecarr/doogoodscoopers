-- get_user_org_id() and get_user_role() are SECURITY DEFINER: they run with the
-- definer's privileges and read public.users. Both were EXECUTE-able by `anon`
-- and `authenticated`, which meant anyone could call them unauthenticated over
-- PostgREST at /rest/v1/rpc/get_user_role.
--
-- Migration 0019 revoked them from PUBLIC, but Supabase had also granted EXECUTE
-- to anon and authenticated *explicitly* (anon=X/postgres), and revoking PUBLIC
-- does not remove an explicit grant — so they stayed callable.
--
-- Nothing uses them: no RLS policy references them (the org-scoped policies
-- inline `SELECT org_id FROM users WHERE id = auth.uid()` instead), no other
-- function calls them, and the app only carries generated type stubs. Revoking
-- EXECUTE is therefore safe; postgres and service_role keep it so a future
-- policy could still use them.

REVOKE ALL ON FUNCTION public.get_user_org_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_role()   FROM PUBLIC, anon, authenticated;

-- Supabase grants EXECUTE on newly created functions to these roles by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
