# Fix Google Sheets archive 404

## Root cause
Server logs show every `append` call hits a 404 from Google. The requested URL contains the full spreadsheet URL where the ID should be:

```
/v4/spreadsheets/https://docs.google.com/spreadsheets/d/1UZHbl...pqv0/edit?gid=0
```

The `GOOGLE_SHEET_ID` secret was saved as the full URL, not the ID segment.

## Fix (pick one — recommended: both)

1. **Update the secret** `GOOGLE_SHEET_ID` to just the ID:
   `1UZHblRdNvurnNEQHbCqC1IdICtNMjhDWTne7eezpqv0`

2. **Harden the server function** `src/lib/sheets-archive.functions.ts` to accept either form. Before building the URL, extract the ID:
   - If the value matches `/spreadsheets/d/([a-zA-Z0-9-_]+)`, use the captured group.
   - Otherwise use the value as-is, after trimming whitespace.

   This makes the integration resilient to whoever sets the secret pasting the URL again.

## Verification
- Send a test message in a task.
- Re-check server logs for `[sheets-archive]` — should show no 404, and the row should appear in Sheet1.
