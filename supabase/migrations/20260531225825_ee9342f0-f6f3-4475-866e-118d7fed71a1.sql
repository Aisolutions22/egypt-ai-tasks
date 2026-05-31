ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.home_messages
  ADD COLUMN IF NOT EXISTS title text;