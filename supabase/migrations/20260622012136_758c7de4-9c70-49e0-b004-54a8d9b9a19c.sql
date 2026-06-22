
-- 1) Replace profiles_update_own with a column-safe version preventing role escalation
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 2) Add explicit UPDATE policy on task-attachments storage (admins/owners only)
DROP POLICY IF EXISTS att_storage_update ON storage.objects;
CREATE POLICY att_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.is_admin_or_owner()
)
WITH CHECK (
  bucket_id = 'task-attachments'
  AND public.is_admin_or_owner()
);
