## Findings from server logs

`archiveMessageToSheet` **is being triggered** — 6 calls in the last hour, all failing at the same guard:

```
[2026-07-02T02:47:22.569Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
[2026-07-02T02:44:55.002Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
[2026-07-02T02:28:09.776Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
[2026-07-02T02:27:38.620Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
[2026-07-02T02:25:15.285Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
[2026-07-02T02:24:40.137Z] [error] [sheets-archive] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID
```

There is no HTTP call to Google, no non-200, no thrown exception — every attempt exits on the missing-secret early return. The function never reaches `fetch` or `getAccessToken`.

## Root cause

Project secrets currently configured:
- GOOGLE_APPS_SCRIPT_SECRET
- GOOGLE_APPS_SCRIPT_URL
- GOOGLE_SHEET_ID ✓
- RESEND_API_KEY
- SEED_OWNER_TOKEN
- LOVABLE_API_KEY

**`GOOGLE_SERVICE_ACCOUNT_JSON` is not set.** `GOOGLE_SHEET_ID` is present, so the guard trips solely on the missing service-account JSON. Without it, `sheets-archive.functions.ts` cannot mint an OAuth token for the Sheets API and returns `{ ok: false }` immediately.

Note: the recent drive-upload migration switched to the Apps Script URL + shared secret (`GOOGLE_APPS_SCRIPT_URL` / `GOOGLE_APPS_SCRIPT_SECRET`), but `sheets-archive.functions.ts` still uses the direct Sheets API path (service account JWT → `sheets.googleapis.com`). So it needs the service-account credentials, not the Apps Script secrets.

## Options to unblock

1. **Add the `GOOGLE_SERVICE_ACCOUNT_JSON` secret** (full JSON key for a service account with edit access on the sheet). The existing code will then work unchanged.
2. **Rewrite `sheets-archive.functions.ts` to POST to the Apps Script** (same pattern as drive-upload), reusing `GOOGLE_APPS_SCRIPT_URL` + `GOOGLE_APPS_SCRIPT_SECRET`. No new secret required, and the Apps Script would need a matching `doPost` branch that appends the row.

Which route do you want?
