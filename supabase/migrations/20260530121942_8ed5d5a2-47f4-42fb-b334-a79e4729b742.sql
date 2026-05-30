
-- ============ Enums ============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'employee');
CREATE TYPE public.task_status AS ENUM ('new', 'inProgress', 'done', 'closed', 'late');
CREATE TYPE public.employee_task_status AS ENUM ('new', 'inProgress', 'done');
CREATE TYPE public.notification_type AS ENUM ('new_task', 'task_done', 'task_late', 'new_message');

-- ============ Tables ============

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  color text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline timestamptz NOT NULL,
  status public.task_status NOT NULL DEFAULT 'new',
  is_home_message boolean NOT NULL DEFAULT false,
  home_message_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- task_assignments
CREATE TABLE public.task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completion_percentage int NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  employee_status public.employee_task_status NOT NULL DEFAULT 'new',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX idx_task_assignments_user ON public.task_assignments(user_id);
CREATE INDEX idx_task_assignments_task ON public.task_assignments(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignments TO authenticated;
GRANT ALL ON public.task_assignments TO service_role;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- task_messages
CREATE TABLE public.task_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.task_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_messages_task ON public.task_messages(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_messages TO authenticated;
GRANT ALL ON public.task_messages TO service_role;
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

-- task_attachments
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- home_messages
CREATE TABLE public.home_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_messages TO authenticated;
GRANT ALL ON public.home_messages TO service_role;
ALTER TABLE public.home_messages ENABLE ROW LEVEL SECURITY;

-- app_settings (single row)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_deadline_days int NOT NULL DEFAULT 2
);
INSERT INTO public.app_settings (id, default_deadline_days) VALUES (1, 2);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============ Helper functions (SECURITY DEFINER) ============

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments ta
    JOIN public.profiles p ON p.id = ta.user_id
    WHERE ta.task_id = _task_id AND p.user_id = auth.uid()
  )
$$;

-- ============ RLS Policies ============

-- profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_owner_delete" ON public.profiles FOR DELETE TO authenticated USING (public.get_my_role() = 'owner');

-- tasks
CREATE POLICY "tasks_select_admin_or_assigned" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_admin_or_owner() OR public.is_assigned_to_task(id));
CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "tasks_update_admin" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin_or_owner());

-- task_assignments
CREATE POLICY "ta_select_admin_or_assigned" ON public.task_assignments FOR SELECT TO authenticated
  USING (public.is_admin_or_owner() OR user_id = public.get_my_profile_id());
CREATE POLICY "ta_insert_admin" ON public.task_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "ta_update_admin_or_self" ON public.task_assignments FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner() OR user_id = public.get_my_profile_id())
  WITH CHECK (public.is_admin_or_owner() OR user_id = public.get_my_profile_id());
CREATE POLICY "ta_delete_admin" ON public.task_assignments FOR DELETE TO authenticated
  USING (public.is_admin_or_owner());

-- task_messages
CREATE POLICY "tm_select_assigned_or_admin" ON public.task_messages FOR SELECT TO authenticated
  USING (public.is_admin_or_owner() OR public.is_assigned_to_task(task_id));
CREATE POLICY "tm_insert_assigned_or_admin" ON public.task_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.get_my_profile_id()
    AND (public.is_admin_or_owner() OR public.is_assigned_to_task(task_id))
  );

-- task_attachments
CREATE POLICY "att_select_assigned_or_admin" ON public.task_attachments FOR SELECT TO authenticated
  USING (public.is_admin_or_owner() OR public.is_assigned_to_task(task_id));
CREATE POLICY "att_insert_assigned_or_admin" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner() OR public.is_assigned_to_task(task_id));

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = public.get_my_profile_id());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = public.get_my_profile_id())
  WITH CHECK (recipient_id = public.get_my_profile_id());
CREATE POLICY "notif_insert_authenticated" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- home_messages
CREATE POLICY "hm_select_all" ON public.home_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "hm_insert_admin" ON public.home_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "hm_update_admin" ON public.home_messages FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

-- app_settings
CREATE POLICY "app_settings_select_all" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_messages;

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "att_storage_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');
CREATE POLICY "att_storage_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');
