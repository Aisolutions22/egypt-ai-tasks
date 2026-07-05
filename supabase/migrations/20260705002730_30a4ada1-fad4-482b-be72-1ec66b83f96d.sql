
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_my_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.profiles WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION private.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION private.is_admin_only()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION private.is_admin_or_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin','owner')) $$;

CREATE OR REPLACE FUNCTION private.is_assigned_to_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments ta
    JOIN public.profiles p ON p.id = ta.user_id
    WHERE ta.task_id = _task_id AND p.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.get_profile_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.id, p.email FROM public.profiles p WHERE private.is_admin_or_owner() $$;

CREATE OR REPLACE FUNCTION private.prevent_task_assignment_key_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin_or_owner() THEN
    IF NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot change task_id or user_id on a task assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.get_my_profile_id()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_my_role()                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin_only()                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin_or_owner()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_assigned_to_task(uuid)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_profile_emails()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.prevent_task_assignment_key_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.get_my_profile_id()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_my_role()             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_only()           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_owner()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_assigned_to_task(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_profile_emails()      TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_prevent_task_assignment_key_change ON public.task_assignments;
CREATE TRIGGER trg_prevent_task_assignment_key_change
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION private.prevent_task_assignment_key_change();

DROP POLICY IF EXISTS app_settings_update_admin ON public.app_settings;
CREATE POLICY app_settings_update_admin ON public.app_settings
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner()) WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS att_delete_admin ON public.task_attachments;
CREATE POLICY att_delete_admin ON public.task_attachments
  FOR DELETE TO authenticated USING (private.is_admin_or_owner());

DROP POLICY IF EXISTS att_insert_assigned_or_admin ON public.task_attachments;
CREATE POLICY att_insert_assigned_or_admin ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_owner() OR private.is_assigned_to_task(task_id));

DROP POLICY IF EXISTS att_select_assigned_or_admin ON public.task_attachments;
CREATE POLICY att_select_assigned_or_admin ON public.task_attachments
  FOR SELECT TO authenticated
  USING (private.is_admin_or_owner() OR private.is_assigned_to_task(task_id));

DROP POLICY IF EXISTS att_update_admin ON public.task_attachments;
CREATE POLICY att_update_admin ON public.task_attachments
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner()) WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS hm_insert_admin ON public.home_messages;
CREATE POLICY hm_insert_admin ON public.home_messages
  FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS hm_update_admin ON public.home_messages;
CREATE POLICY hm_update_admin ON public.home_messages
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner()) WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS notif_insert_restricted ON public.notifications;
CREATE POLICY notif_insert_restricted ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin_or_owner()
    OR (
      task_id IS NOT NULL
      AND private.is_assigned_to_task(task_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = notifications.recipient_id
          AND (p.role = 'admin'::public.app_role OR p.role = 'owner'::public.app_role)
      )
    )
  );

DROP POLICY IF EXISTS notif_select_own ON public.notifications;
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = private.get_my_profile_id());

DROP POLICY IF EXISTS notif_update_own ON public.notifications;
CREATE POLICY notif_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = private.get_my_profile_id())
  WITH CHECK (recipient_id = private.get_my_profile_id());

DROP POLICY IF EXISTS profiles_owner_delete ON public.profiles;
CREATE POLICY profiles_owner_delete ON public.profiles
  FOR DELETE TO authenticated USING (private.get_my_role() = 'owner'::public.app_role);

DROP POLICY IF EXISTS ta_delete_admin ON public.task_assignments;
CREATE POLICY ta_delete_admin ON public.task_assignments
  FOR DELETE TO authenticated USING (private.is_admin_or_owner());

DROP POLICY IF EXISTS ta_insert_admin ON public.task_assignments;
CREATE POLICY ta_insert_admin ON public.task_assignments
  FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS ta_select_admin_or_assigned ON public.task_assignments;
CREATE POLICY ta_select_admin_or_assigned ON public.task_assignments
  FOR SELECT TO authenticated
  USING (private.is_admin_or_owner() OR user_id = private.get_my_profile_id());

DROP POLICY IF EXISTS ta_update_admin_only ON public.task_assignments;
CREATE POLICY ta_update_admin_only ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner()) WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS tasks_delete_admin ON public.tasks;
CREATE POLICY tasks_delete_admin ON public.tasks
  FOR DELETE TO authenticated USING (private.is_admin_or_owner());

DROP POLICY IF EXISTS tasks_insert_admin ON public.tasks;
CREATE POLICY tasks_insert_admin ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS tasks_select_admin_or_assigned ON public.tasks;
CREATE POLICY tasks_select_admin_or_assigned ON public.tasks
  FOR SELECT TO authenticated
  USING (private.is_admin_or_owner() OR private.is_assigned_to_task(id));

DROP POLICY IF EXISTS tasks_update_admin ON public.tasks;
CREATE POLICY tasks_update_admin ON public.tasks
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner()) WITH CHECK (private.is_admin_or_owner());

DROP POLICY IF EXISTS tm_insert_assigned_or_admin_only ON public.task_messages;
CREATE POLICY tm_insert_assigned_or_admin_only ON public.task_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = private.get_my_profile_id()
    AND (private.is_admin_only() OR private.is_assigned_to_task(task_id))
  );

DROP POLICY IF EXISTS tm_select_assigned_or_admin_only ON public.task_messages;
CREATE POLICY tm_select_assigned_or_admin_only ON public.task_messages
  FOR SELECT TO authenticated
  USING (private.is_admin_only() OR private.is_assigned_to_task(task_id));

DROP POLICY IF EXISTS att_storage_delete ON storage.objects;
CREATE POLICY att_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND private.is_admin_or_owner());

DROP POLICY IF EXISTS att_storage_insert ON storage.objects;
CREATE POLICY att_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (
      private.is_admin_or_owner()
      OR private.is_assigned_to_task(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS att_storage_read ON storage.objects;
CREATE POLICY att_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      private.is_admin_or_owner()
      OR private.is_assigned_to_task(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS att_storage_update ON storage.objects;
CREATE POLICY att_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-attachments' AND private.is_admin_or_owner())
  WITH CHECK (bucket_id = 'task-attachments' AND private.is_admin_or_owner());

DROP FUNCTION IF EXISTS public.get_profile_emails();
DROP FUNCTION IF EXISTS public.is_admin_only();
DROP FUNCTION IF EXISTS public.is_admin_or_owner();
DROP FUNCTION IF EXISTS public.is_assigned_to_task(uuid);
DROP FUNCTION IF EXISTS public.get_my_profile_id();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.prevent_task_assignment_key_change();

CREATE OR REPLACE FUNCTION public.get_profile_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.get_profile_emails() $$;

REVOKE ALL ON FUNCTION public.get_profile_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_emails() TO authenticated;
