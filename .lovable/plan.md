## Inspect `GOOGLE_OAUTH_REFRESH_TOKEN` at runtime (read-only, no reveal)

Extend the existing diagnostic route `src/routes/api/public/drive-env-diag.ts` to report structural facts about the stored refresh token without exposing its value. Then invoke the live published endpoint and report the results.

### What the route will compute (server-side, on the raw `process.env.GOOGLE_OAUTH_REFRESH_TOKEN` string)

- `startsWith4` — first 4 characters (safe fingerprint, per your request)
- `endsWith4` — last 4 characters
- `length` — total character count
- `newlineCount` — count of `\n` + `\r`
- `hasWhitespace` — `/\s/.test(v)`
- `hasDoubleQuote` — includes `"`
- `hasSingleQuote` — includes `'`
- `beginsWith_1SlashSlash` — starts with `1//`
- `containsAnother_1SlashSlash` — `1//` appears again after index 0
- `looksLikeBase64` — matches `/^[A-Za-z0-9+/=]+$/` (pure base64 alphabet, no `//`, no `-`, no `_`)
- `hasNonPrintable` — any char with code `< 0x20` (except tab/newline reported above) or `= 0x7F`
- Bump `DEPLOYMENT_MARKER` to a new value so we can prove the new diagnostic is live

### Steps

1. Edit `src/routes/api/public/drive-env-diag.ts` — add a `describeToken()` helper and include its result only for `GOOGLE_OAUTH_REFRESH_TOKEN`. Existing fingerprint output for the other three secrets is preserved.
2. Wait for auto-deploy, then GET `/api/public/drive-env-diag` on the published URL.
3. Report the fields above verbatim to you. No writes, no secret updates, no changes to `uploadDriveFile`.

### Notes

- The token value is never logged, returned in full, or hashed against known values.
- Only 8 characters total (`startsWith4` + `endsWith4`) are exposed — the minimum needed to answer your questions.
- No other file is modified.