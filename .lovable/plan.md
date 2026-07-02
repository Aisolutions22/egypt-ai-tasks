1. Update the Lovable secret `GOOGLE_APPS_SCRIPT_URL` to the new Apps Script deployment URL:
   `https://script.google.com/macros/s/AKfycbwyzqSsx2swk4E9nDglFE4enl1UdCgAjQFfUmFZ28DO9uyGGspK0klyVKoq0KMk1Xp0/exec`
2. Build the project so the server function picks up the new secret value.
3. After the user performs one manual file upload, pull the latest `[drive-upload][diag]` server-function logs and report the exact HTTP status and raw response body from the Apps Script call without summarizing.

No code, flow, business logic, or database changes will be made. The diagnostics already in `src/lib/drive-upload.functions.ts` remain untouched.