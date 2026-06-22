## Goal
Prevent anonymous access to `/api/public/seed-owner` by requiring a secret token, and provision that secret.

## Changes

### 1. `src/routes/api/public/seed-owner.ts`
At the very top of the `GET` handler — before reading Supabase env vars or touching the database — add a token check:

- Parse `token` from the request URL query string (`new URL(request.url).searchParams.get("token")`).
- Read `process.env.SEED_OWNER_TOKEN`.
- If the env var is missing, return `403` with `{ ok: false, error: "Forbidden" }` (fail closed — never allow when unconfigured).
- If the query token is missing or does not exactly match, return `403` with `{ ok: false, error: "Forbidden" }`.
- Use a length-equal + constant-time compare (Node `crypto.timingSafeEqual` on `Buffer.from(...)`, guarded by equal length) to avoid timing leaks.
- Update the handler signature to `GET: async ({ request }) => { ... }`.

No other logic changes.

### 2. Add Lovable Secret `SEED_OWNER_TOKEN`
Generate a long random value (e.g. 48 bytes hex / base64url) and store it as a runtime secret via the secrets tool so it's available as `process.env.SEED_OWNER_TOKEN` in the server route.

### 3. Usage
After deploy, the endpoint must be called as:
```
GET /api/public/seed-owner?token=<SEED_OWNER_TOKEN>
```
All other requests get `403`.

## Notes
- Endpoint stays under `/api/public/*` (no platform auth), security enforced inside the handler — matches the public-route guidance.
- Existing "owner already exists" short-circuit remains, so even with the token the endpoint is effectively single-use.
