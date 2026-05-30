# Ai Tasks Solutions — Build Plan

A full Arabic RTL task management system with roles (Owner/Admin/Employee), tasks, conversations, home messages, archive, notifications, and email.

## Stack notes (deviations from your brief)

- **Router**: this template uses **TanStack Router** (file-based routes under `src/routes/`), not React Router. Same UX, different API.
- **Backend**: **Lovable Cloud** (Supabase under the hood) — database, auth, storage, realtime, server functions.
- **Email**: Resend via Lovable connector + a TanStack server function (not a Supabase Edge Function — TanStack Start handles server logic natively).
- **Admin user creation**: `supabase.auth.admin.*` requires the service role key, so creating colleagues and deleting users will run in a server function using the admin client (never exposed to browser).
- **Styling**: Tailwind v4 with tokens in `src/styles.css` (oklch). The `#FF6B2B` orange + `#FFF5F0` background will be added as semantic tokens; components consume tokens, not raw hex.
- **Fonts**: Tajawal loaded via Google Fonts in the root `<head>`.

## Phase 1 — Foundation

1. Enable Lovable Cloud.
2. Add Tajawal font + RTL (`<html dir="rtl" lang="ar">`) in `__root.tsx`.
3. Extend `src/styles.css` with brand tokens (primary orange, surface glass, status colors, dark text) and the animated gradient-orb background (3 absolutely-positioned blurred divs + `@keyframes float`).
4. Configure Supabase clients (browser, auth middleware, admin server) — already scaffolded by Cloud.
5. Install: `date-fns` (with `ar` locale).

## Phase 2 — Database (single migration)

Create all 8 tables exactly as specified (`profiles`, `tasks`, `task_assignments`, `task_messages`, `task_attachments`, `notifications`, `home_messages`, `app_settings`), with:
- GRANTs to `authenticated` + `service_role`.
- `app_role` enum + separate `user_roles` pattern is NOT used here since you defined roles on `profiles`; we'll instead expose a `SECURITY DEFINER` function `public.current_role()` returning the caller's role from `profiles`, and use it inside RLS policies to avoid recursion.
- RLS policies per your table matrix.
- Storage bucket `task-attachments` (private) + policies.
- Trigger to auto-update `tasks.status='late'` is admin-driven (no cron needed; UI button + scheduled check optional).
- Seed: insert owner profile row after the auth user is created (done from a one-shot server function on first run, not in SQL, since `auth.users` insert needs admin client).

## Phase 3 — Auth + Layout

- `/login` route (public): email/password, Tajawal-styled glass card on gradient background.
- `_authenticated` layout route: gate via `supabase.auth.getUser()` in `beforeLoad`, redirect to `/login` otherwise.
- Root `onAuthStateChange` listener invalidates router + query cache.
- App shell inside `_authenticated`:
  - Right-side fixed sidebar (RTL) 248px: logo, nav links (filtered by role), bell with unread badge, user chip, logout.
  - Mobile (≤768px): sidebar becomes off-canvas drawer; sticky top bar with hamburger + logo.

## Phase 4 — Pages

Routes (TanStack file-based):
- `_authenticated/dashboard.tsx` — Home Message banner (owner/admin) + stats + employee grid (admin/owner) or own tasks grid (employee). Late tasks pulse red.
- `_authenticated/task/$id.tsx` — header + info bar + threaded conversation (Supabase Realtime on `task_messages`), reply, attachments (upload to Storage), completion slider for employees, admin Done/Late buttons.
- `_authenticated/add-task.tsx` — admin/owner only; multi-assign chips, deadline default from `app_settings`, optional Home Message toggle. On submit: insert task + assignments + optional home_message, fire server fn to send Resend emails + create notifications.
- `_authenticated/add-colleague.tsx` — owner/admin; calls server fn that uses admin client to create auth user + profile; 12-color palette with taken colors disabled.
- `_authenticated/archive.tsx` — owner/admin; closed tasks list + search; click opens task detail in read-only.
- `_authenticated/settings.tsx` — personal section (everyone) + admin section (default deadline slider, colleagues table, owner-only delete).

Role gates in each route's `beforeLoad`; non-admins redirect to `/dashboard`.

## Phase 5 — Cross-cutting features

- **Notifications**: bell dropdown subscribed to `notifications` via Realtime; click marks read + navigates.
- **Color system**: helper hook `useTakenColors()`; uniqueness checked server-side on profile update/insert.
- **Status system**: enum + Arabic label/color map in one shared file; reused everywhere.
- **Home message banner**: query `home_messages` where active and not expired; dismiss = update `is_active=false`; "+N أخرى" modal lists all.
- **Email server function** (`src/lib/email.functions.ts`): uses Resend via Lovable connector gateway; called from add-task server fn and from employee "done" handler.
- **Dates**: helper `formatArabic(date)` wrapping `date-fns` with `ar` locale + Arabic-Indic digit conversion.
- **UI primitives**: shadcn for dialog, dropdown, toast (sonner), slider, popover, skeleton, tabs.
- **Empty states + skeletons + Arabic toasts** as specified.

## Phase 6 — Polish & verify

- Mobile breakpoints, 44px touch targets.
- Optimistic message send.
- Confirm-dialogs for destructive actions.
- Manual smoke test of each checklist item from your brief.

## Open questions (will assume defaults unless you say otherwise)

1. **Seed owner**: I'll create a one-time setup server route `/api/public/seed-owner` that creates `admin@aitasks.com / Admin@2024` if no owner exists. You hit it once after first deploy. OK?
2. **Resend**: I'll set it up via the Resend connector (you'll be prompted to connect when we get to email). Sender defaults to `onboarding@resend.dev` until you verify a domain.
3. **Storage bucket** for attachments will be private with signed URLs on read. OK?

Reply "go" (with any answers to the 3 questions) and I'll start building.