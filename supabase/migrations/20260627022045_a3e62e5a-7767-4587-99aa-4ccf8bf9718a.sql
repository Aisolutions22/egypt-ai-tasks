
-- 1) Restrict email column on profiles to admins/owners
REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;

-- 2) Add UPDATE and DELETE policies for task_attachments (admin/owner only)
CREATE POLICY "att_update_admin" ON public.task_attachments
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "att_delete_admin" ON public.task_attachments
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner());
