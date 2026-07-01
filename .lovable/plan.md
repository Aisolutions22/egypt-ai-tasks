## Status

The code changes you're describing are already in place in `src/lib/drive-upload.functions.ts`:

- `getDriveAccessTokenViaOAuth()` exists and reads `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, POSTs to `oauth2.googleapis.com/token` as form-urlencoded, and throws `OAuth token refresh failed ${status}: ${text}` on non-ok responses (raw body included).
- `uploadDriveFile` calls `getDriveAccessTokenViaOAuth()` — no more `GOOGLE_SERVICE_ACCOUNT_JSON` parsing here.
- Folder-ID URL parsing, multipart body, `${taskTitle} - ${displayName}${ext}` naming, and try/catch returning `{ok:false, error}` are all intact.
- `src/lib/sheets-archive.functions.ts` still uses the Service Account — untouched.

The three secrets are already registered too. Latest server logs show the token exchange itself returning:

```
401 { "error": "invalid_client", "error_description": "The provided client secret is invalid." }
```

So Google is rejecting the `client_id` / `client_secret` pair before the refresh token is even evaluated. No code change will fix that.

## Plan

1. Re-open the secure secrets form for `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` so you can re-paste them from the **same** OAuth 2.0 Client in Google Cloud Console → Credentials that was used in OAuth Playground to mint the refresh token `1//049t9b...`.
   - Common causes of `invalid_client`: a stray space/newline in the secret, or the ID/secret pair belongs to a different OAuth client than the one that issued the refresh token.
2. Retry an upload. Pull fresh `drive-upload` logs to confirm.
   - If it now succeeds → done.
   - If it flips to `invalid_grant` → the refresh token was minted under a different client; regenerate it in OAuth Playground with "Use your own OAuth credentials" set to this same client, then update `GOOGLE_OAUTH_REFRESH_TOKEN`.
   - If it still says `invalid_client` → the pair still doesn't match; create a fresh OAuth 2.0 Client ID (Web application) in Google Cloud, mint a new refresh token with it in OAuth Playground, and re-enter all three secrets.

No file edits needed.
