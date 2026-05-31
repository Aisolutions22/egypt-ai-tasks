
-- 1) Restrict notifications INSERT: admin/owner OR sender on a task they're part of
DROP POLICY IF EXISTS notif_insert_authenticated ON public.notifications;

CREATE POLICY notif_insert_restricted ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_owner()
  OR (
    task_id IS NOT NULL
    AND public.is_assigned_to_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = recipient_id
        AND (p.role = 'admin'::app_role OR p.role = 'owner'::app_role)
    )
  )
);

-- 2) Storage: task-attachments — tighten read/insert to assignment, add delete (admin only)
DROP POLICY IF EXISTS att_storage_read_auth   ON storage.objects;
DROP POLICY IF EXISTS att_storage_insert_auth ON storage.objects;
DROP POLICY IF EXISTS att_storage_read        ON storage.objects;
DROP POLICY IF EXISTS att_storage_insert      ON storage.objects;
DROP POLICY IF EXISTS att_storage_delete      ON storage.objects;

CREATE POLICY att_storage_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    public.is_admin_or_owner()
    OR public.is_assigned_to_task( ((storage.foldername(name))[1])::uuid )
  )
);

CREATE POLICY att_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    public.is_admin_or_owner()
    OR public.is_assigned_to_task( ((storage.foldername(name))[1])::uuid )
  )
);

CREATE POLICY att_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.is_admin_or_owner()
);

-- 3) Lock down SECURITY DEFINER helper functions: revoke from anon/public,
--    keep authenticated since RLS policies need to call them.
REVOKE EXECUTE ON FUNCTION public.get_my_profile_id()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_task(uuid)     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_profile_id()           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_role()                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_owner()           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_assigned_to_task(uuid)     TO authenticated;
