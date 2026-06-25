CREATE OR REPLACE FUNCTION public.is_admin_only()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_only() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_only() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_only() TO authenticated;

DROP POLICY IF EXISTS "tm_select_assigned_or_admin" ON public.task_messages;
CREATE POLICY "tm_select_assigned_or_admin_only" ON public.task_messages FOR SELECT TO authenticated
  USING (public.is_admin_only() OR public.is_assigned_to_task(task_id));

DROP POLICY IF EXISTS "tm_insert_assigned_or_admin" ON public.task_messages;
CREATE POLICY "tm_insert_assigned_or_admin_only" ON public.task_messages FOR INSERT TO authenticated
  WITH CHECK ((sender_id = get_my_profile_id()) AND (public.is_admin_only() OR public.is_assigned_to_task(task_id)));