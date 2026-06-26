Remove the visible completion-percentage feature from three UI surfaces while leaving the underlying `task_assignments.completion_percentage` database column and `add-task.tsx` untouched.

### 1. `src/routes/_authenticated/task/$id.tsx`
- Delete the `pct`/`setPct` state and the `useEffect` that syncs it from `myAssignment`.
- Delete the `task_assignments` update block inside `send()` (the one that writes `completion_percentage` and `employee_status`), keeping the `task_messages` insert and admin notification logic unchanged.
- Delete the "نسبة الإنجاز" label + `<Slider>` block above the send button.
- In the "منسوب إلى" assignee chips, remove the percentage badge span (`{toArabicDigits(a.completion_percentage)}%`), keeping only the name and color dot.
- Drop the now-unused `Slider` import if it is no longer used elsewhere in the file.

### 2. `src/components/task-card.tsx`
- Remove `percentage` from `TaskCardData` interface.
- Remove the entire `<Progress>` + percentage-text block that renders when `percentage > 0`.
- Remove the `Progress` import and `toArabicDigits` import if they become unused.

### 3. `src/routes/_authenticated/dashboard.tsx`
- Remove `completion_percentage` from the `task_assignments` select query.
- Update `TaskRow` type so `task_assignments` only contains `user_id`.
- Remove the `percentage` parameter from `toCard` and stop passing `my?.completion_percentage` / `a?.completion_percentage` at the two `TaskCard` call sites.

### 4. What is NOT changing
- `add-task.tsx` stays as-is.
- Database schema, RLS, and `task_assignments.completion_percentage` column remain untouched.
- No migration needed.

After edits, run a type-check to confirm no broken references or unused-import warnings.