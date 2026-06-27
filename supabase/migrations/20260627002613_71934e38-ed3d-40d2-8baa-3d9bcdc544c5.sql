
-- Fix 1: Hide profiles.email from non-admin authenticated users via column-level grants
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, user_id, full_name, role, color, created_at, is_active, avatar_url)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Admin/owner-only function to retrieve emails for the staff list
CREATE OR REPLACE FUNCTION public.get_profile_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE public.is_admin_or_owner();
$$;

REVOKE ALL ON FUNCTION public.get_profile_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_emails() TO authenticated;

-- Fix 2: Remove the over-permissive employee self-update policy on task_assignments.
-- Admins/owners retain full update access via ta_update_admin_only.
DROP POLICY IF EXISTS ta_update_self_progress ON public.task_assignments;
