## Add temporary diagnostic logging to `uploadDriveFile`

Edit `src/lib/drive-upload.functions.ts` only. No business logic changes, no Apps Script changes.

### Logging to add inside the handler

All logs prefixed `[drive-upload][diag]` so they're easy to grep and remove later.

1. **Before fetch** — log request URL (host + path only, no secret) and payload metadata: `fileName`, `displayName`, `mimeType`, `companyName`, `extension`, `base64Length`.
2. **After fetch** — log `res.status`, `res.statusText`, and `content-type` header.
3. **Raw response body** — log the full `text` returned by Apps Script (truncated to 2000 chars to avoid log spam).
4. **JSON parse** — inside the existing `catch`, log the parse error message alongside the raw text snippet.
5. **Apps Script `ok:false`** — log full parsed JSON (`errorCode`, `error`, and any extra fields).
6. **Outer `catch`** — log `err.name`, `err.message`, and `err.stack` in addition to the existing `console.error`.

### Return values

Unchanged. Same `{ ok, ... }` shapes as today.

### Follow-up

After we identify the failing step from logs, a subsequent turn will strip the `[diag]` lines.
