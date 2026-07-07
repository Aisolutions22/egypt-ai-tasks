
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.get_my_role() IN ('owner'::app_role, 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.task_assignments ta_self
    JOIN public.task_assignments ta_other ON ta_other.task_id = ta_self.task_id
    WHERE ta_self.user_id = auth.uid()
      AND ta_other.user_id = profiles.user_id
  )
);
