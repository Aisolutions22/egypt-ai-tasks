## Plan: Lock owner out of chat, fix settings visibility, add password reset exception

### Part 1 — Database migration
New migration adding:
- `public.is_admin_only()` SECURITY DEFINER function (returns true only when `role = 'admin'`), with EXECUTE revoked from PUBLIC/anon and granted to authenticated.
- Drop `tm_select_assigned_or_admin` on `task_messages`; recreate as `tm_select_assigned_or_admin_only` using `is_admin_only() OR is_assigned_to_task(task_id)`.
- Replace the `task_messages` INSERT policy to use `is_admin_only()` instead of `is_admin_or_owner()`.
- Leave `tasks` SELECT policy untouched (owner still sees names/status/counts).

### Part 2 — Route guard
In `src/routes/_authenticated/task/$id.tsx`, add a `beforeLoad` matching the `add-colleague.tsx` pattern: fetch current user's profile role; if `role === "owner"`, `throw redirect({ to: "/dashboard" })`.

### Part 3 — Non-clickable task cards for owner
- `src/components/task-card.tsx`: add optional `disableLink?: boolean`. When true, wrap content in a `<div>` with the same className/styling as the `<Link>`; otherwise keep the existing `<Link to="/task/$id">`.
- `src/routes/_authenticated/dashboard.tsx`: derive `isOwner = me?.role === "owner"` and pass `disableLink={isOwner}` to every `<TaskCard />`.
- `src/routes/_authenticated/archive.tsx`: when viewer role is "owner", render each archived task's name/status/date in a plain `<div>` (same layout) instead of `<Link to="/task/$id">`.

### Part 4 — Settings fixes
In `src/routes/_authenticated/settings.tsx`:
- Ensure `isAdminOnly = me?.role === "admin"` exists.
- Change wrapping condition of "System Settings" and "الموظفون" sections from `{isAdmin && ...}` to `{isAdminOnly && ...}`.
- Hide the entire "Change Password" section when viewer's own `role === "owner"`.
- Remove the `p.role !== "owner"` exclusion from the reset-password (KeyRound) button only, so admins can reset the owner's password. Keep that exclusion in place for any other owner-related controls.

### Technical notes
- No changes to `tasks` policies, `is_admin_or_owner()`, or other call sites of it.
- No changes to business logic in task messaging beyond the two policy swaps.
- Route guard uses the existing `supabase` client + `profiles` lookup pattern already in `add-colleague.tsx`, so no new server function is needed.
