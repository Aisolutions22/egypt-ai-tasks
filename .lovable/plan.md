## Verify Drive upload with new refresh token

1. Invoke the `uploadDriveFile` server function with a small test payload against the published deployment.
2. Check the server function logs for the token-exchange step (`oauth2.googleapis.com/token`) and the Drive upload step (`googleapis.com/upload/drive/v3/files`).
3. Report back:
   - HTTP status of the server function response
   - Whether token refresh succeeded (no 401 `unauthorized_client`)
   - Whether the Drive upload returned a file ID
   - Literal error text if any step fails

No code changes.