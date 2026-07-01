## Diagnosis

Server logs show the last 4 `uploadDriveFile` attempts all failed at the **token-exchange step** (never reached Drive upload):

```
OAuth token refresh failed 401: {
  "error": "invalid_client",
  "error_description": "The provided client secret is invalid."
}
```

Google rejects the `client_id` + `client_secret` pair before a token is minted. The refresh token itself is not even evaluated at this stage.

## Root cause

`GOOGLE_OAUTH_CLIENT_SECRET` (and possibly `GOOGLE_OAUTH_CLIENT_ID`) stored in project secrets does not match the OAuth client that issued the refresh token `1//049t9b...`. Typical causes:
- Client secret was copied with a stray space/newline or truncated.
- The refresh token was generated in the OAuth Playground (or a script) using a *different* OAuth client than the one whose ID/secret you saved here.

## Fix

No code change needed — the code path is correct. Update the secrets so all three belong to the same OAuth 2.0 Client ID in Google Cloud Console:

1. Open Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 Client used to mint the refresh token.
2. Copy its **Client ID** and **Client secret** exactly.
3. Re-enter both in Lovable via the secure form (I'll open it):
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
4. Confirm `GOOGLE_OAUTH_REFRESH_TOKEN` was generated under that same client (if not, regenerate via OAuth Playground with "Use your own OAuth credentials" enabled and paste the fresh refresh token).
5. Retry an upload. If it still 401s with `invalid_client`, the mismatch is on the refresh-token side — regenerate it.

If the client ID/secret pair is correct but you get `invalid_grant` on the next attempt, that's a different error and means the refresh token is expired/revoked — I'll guide re-consent.
