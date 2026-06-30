ALTER TABLE public.task_attachments
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_view_url text;

-- Make uploaded_by required going forward for new rows
ALTER TABLE public.task_attachments ALTER COLUMN uploaded_by SET NOT NULL;