## Inspect runtime secrets for `uploadDriveFile`

There is no way to read the running Worker's `process.env` without deploying code that reports it. I will add a minimal, auth-gated diagnostic server function, deploy it, invoke it against the live published deployment, and report the raw result.

### Steps

1. Create `src/lib/drive-debug.functions.ts` with a `driveEnvDiag` server function:
   - `.middleware([requireSupabaseAuth])` so it is not a public endpoint.
   - Reads `process.env` **inside** the handler (per project rules).
   - Returns, for each of `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`:
     - `present: boolean`
     - `length: number`
     - `first4` and `last4` characters (safe fingerprint — enough to tell if the value changed, without revealing it)
     - `sha256` (hex, first 12 chars) as a stable fingerprint
   - Also returns a `deploymentMarker` string hardcoded in this file (e.g. a timestamp/UUID I embed at write time). If the invocation returns that marker, the running deployment includes this new code — proving it is the latest build. If the function 404s or returns an older marker, the running deployment is stale.

2. Wait for the automatic deploy, then invoke via `stack_modern--invoke-server-function` against the published URL.

3. Report literal output:
   - Per-secret `present` / `length` / `first4…last4` / `sha256[0..12]`
   - The `deploymentMarker` echoed back, confirming whether the live deployment is running the new code (and therefore the latest secrets snapshot).

4. Compare the refresh-token fingerprint to the value you last set (`1//040vZGxF…EyEWDUo9kXFuUmA` → first4 `1//0`, last4 `UmA`) to confirm the Worker actually sees the updated secret, not a cached older one.

### Technical notes

- Secrets in Lovable Cloud / Cloudflare Workers bind at request time; a server function must re-read `process.env` inside the handler. Secret updates take effect on the next request after the Worker picks up the new binding (typically immediate, but this diagnostic will prove it).
- No values are logged or returned in the clear — only length + 8 chars of fingerprint + a truncated SHA-256. That is sufficient to answer questions 1–5 without leaking secrets.
- No existing files are modified. Only one new file is added.
