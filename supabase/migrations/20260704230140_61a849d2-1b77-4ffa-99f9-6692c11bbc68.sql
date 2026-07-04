
-- 1) Hide email column from non-admins by revoking column-level SELECT.
--    The existing profiles_select_all policy still allows row visibility for
--    non-sensitive columns, but the email column is no longer readable via
--    the Data API by authenticated users. Admins/owners continue to access
--    emails via the get_profile_emails() SECURITY DEFINER RPC.
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;

-- 2) Lock down SECURITY DEFINER functions: revoke from PUBLIC and anon so
--    unauthenticated callers cannot invoke them. RLS policies calling these
--    helpers run as SECURITY DEFINER and are unaffected.
REVOKE EXECUTE ON FUNCTION public.get_profile_emails() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_only() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_task_assignment_key_change() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated users can still call the helpers they need
GRANT EXECUTE ON FUNCTION public.get_profile_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
