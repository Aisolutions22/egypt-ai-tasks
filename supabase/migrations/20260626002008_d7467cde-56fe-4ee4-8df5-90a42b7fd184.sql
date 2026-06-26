-- Add SELECT policy for avatars bucket so users can read avatars (public-readable avatars)
CREATE POLICY "Avatars are readable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Restrict task_assignments self-update to prevent reassigning task_id or user_id
DROP POLICY IF EXISTS ta_update_admin_or_self ON public.task_assignments;

CREATE POLICY ta_update_admin_only
ON public.task_assignments FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner())
WITH CHECK (public.is_admin_or_owner());

CREATE POLICY ta_update_self_progress
ON public.task_assignments FOR UPDATE
TO authenticated
USING (user_id = public.get_my_profile_id())
WITH CHECK (
  user_id = public.get_my_profile_id()
  AND task_id = (SELECT task_id FROM public.task_assignments ta2 WHERE ta2.id = task_assignments.id)
);

-- Trigger to prevent non-admins from changing task_id or user_id on their own row
CREATE OR REPLACE FUNCTION public.prevent_task_assignment_key_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_owner() THEN
    IF NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot change task_id or user_id on a task assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_task_assignment_key_change ON public.task_assignments;
CREATE TRIGGER trg_prevent_task_assignment_key_change
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.prevent_task_assignment_key_change();