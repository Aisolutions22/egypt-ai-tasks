## Extend diagnostics in `src/lib/drive-upload.functions.ts`

The file already contains most `[drive-upload][diag]` logs from the previous turn. This plan adds the remaining items from the spec without touching any business logic, return values, Apps Script, secrets, or DB.

### Edits (only file: `src/lib/drive-upload.functions.ts`)

1. **Startup log (new, before env check)**
   - `[drive-upload][diag] upload started` with:
     - `displayName`, `companyName` (= `taskTitle`), `extension` (derived), `mimeType`, `base64Length`, `finalFileName` (= `data.fileName`)
     - `hasScriptUrl` (boolean), `hasScriptSecret` (boolean)
   - Never log secret values.

2. **Before fetch (extend existing log)**
   - Log `urlOrigin` and `urlPathname` as separate fields (already computed via `new URL`). Drop query string.

3. **After fetch (already present)** — keep `status`, `statusText`, `content-type`.

4. **Raw body (already present)** — first 2000 chars, before JSON.parse.

5. **JSON parse failure (already present)** — keep parse error message + first 500 chars. Return value unchanged.

6. **Parsed JSON success path (new explicit log)**
   - After successful `JSON.parse`, log the full parsed object including `ok`, `error`, `errorCode`, `fileId`, `viewUrl`, `fileName`.

7. **Non-200 branch (extend)**
   - When `!res.ok`: additionally log all response headers (via `Object.fromEntries(res.headers)`) alongside status and raw body.

8. **Thrown exception (already present)** — keep `name`, `message`, `stack`.

9. **Success log (new)**
   - Before `return { ok: true, ... }`: log `[drive-upload][diag] upload completed successfully` with `fileId` and `viewUrl`.

### Not changed
- Return shapes, validation, secret handling, Apps Script payload, environment variables, database.

### After implementation
- Build runs automatically.
- User uploads one file manually via the app UI.
- Logs location: **Backend → Functions → server-function logs** for `uploadDriveFile` (filter by `[drive-upload][diag]`). I can also pull them here with the server-function logs tool once the upload attempt is made.
- No fix will be attempted until we read the logs and identify the failing step.
