## Switch Drive uploads to OAuth refresh-token auth

Service accounts have no storage quota in personal My Drive (root cause of the 403). Switching Drive uploads to OAuth impersonates a real Google user, so uploads land in that user's Drive quota. Sheets archive keeps using the Service Account — untouched.

### Changes

**1. `src/lib/drive-upload.functions.ts`**
- Add `getDriveAccessTokenViaOAuth()`:
  - Reads `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` from `process.env`.
  - POSTs to `https://oauth2.googleapis.com/token` (form-urlencoded) with `grant_type=refresh_token` + the three values.
  - Returns `access_token`; throws with raw response body on non-OK.
- In `uploadDriveFile` handler:
  - Remove `GOOGLE_SERVICE_ACCOUNT_JSON` parsing and the `getAccessToken(sa.client_email, ...)` call.
  - Drop the `import { getAccessToken }` from `./sheets-archive.functions`.
  - Call `getDriveAccessTokenViaOAuth()` instead.
  - Keep everything else identical: folder-ID URL parsing, multipart body, `${taskTitle} - ${displayName}${ext}` naming, try/catch error shape, 100MB guard.

**2. `src/lib/sheets-archive.functions.ts`** — untouched.

### Secrets

Add three secrets:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN` — will be set to the value you provided (`1//049t9b...`) via `set_secret`, so no form needed for that one. Client ID/Secret will open the secure form for you to paste.

### Verification

After secrets are configured, trigger an upload from the task page and confirm HTTP 200 from Drive (file appears in the target folder, `webViewLink` returned). If it fails, the raw Google response body will be in the server logs.
