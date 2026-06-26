DELETE FROM public.tasks t
WHERE NOT EXISTS (SELECT 1 FROM public.task_assignments a WHERE a.task_id = t.id)
  AND EXISTS (
    SELECT 1 FROM public.home_messages h
    WHERE h.title = t.title AND h.created_by = t.created_by
  );