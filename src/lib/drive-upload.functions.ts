import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  taskTitle: z.string(),
  fileName: z.string(),
  displayName: z.string(),
  mimeType: z.string(),
  base64Data: z.string(),
});

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getDriveAccessTokenViaOAuth(): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN");
  }
  const body =
    `grant_type=refresh_token` +
    `&refresh_token=${encodeURIComponent(refreshToken)}` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth token refresh failed ${res.status}: ${text}`);
  }
  const json = JSON.parse(text) as { access_token: string };
  return json.access_token;
}

export const uploadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      if (data.base64Data.length * 0.75 > 100 * 1024 * 1024) {
        return { ok: false as const, error: "الملف كبير جداً" };
      }
      const rawFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const folderMatch = rawFolderId?.match(/\/folders\/([a-zA-Z0-9-_]+)/);
      const folderId = (folderMatch ? folderMatch[1] : rawFolderId)?.trim();
      if (!folderId) {
        console.error("[drive-upload] missing GOOGLE_DRIVE_FOLDER_ID");
        return { ok: false as const, error: "إعدادات Drive غير مكتملة" };
      }
      const accessToken = await getDriveAccessTokenViaOAuth();

      const dotIdx = data.fileName.lastIndexOf(".");
      const fileExtension = dotIdx >= 0 ? data.fileName.slice(dotIdx) : "";
      const metadata = {
        name: `${data.taskTitle} - ${data.displayName}${fileExtension}`,
        parents: [folderId],
      };

      const boundary = `-------lovable-boundary-${crypto.randomUUID()}`;
      const fileBytes = base64ToBytes(data.base64Data);

      const encoder = new TextEncoder();
      const preamble = encoder.encode(
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${data.mimeType}\r\n\r\n`,
      );
      const closing = encoder.encode(`\r\n--${boundary}--`);

      const body = new Uint8Array(preamble.length + fileBytes.length + closing.length);
      body.set(preamble, 0);
      body.set(fileBytes, preamble.length);
      body.set(closing, preamble.length + fileBytes.length);

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error(`[drive-upload] ${res.status}: ${text}`);
        return { ok: false as const, error: `upload ${res.status}` };
      }
      const json = (await res.json()) as { id: string; webViewLink: string };
      return { ok: true as const, driveFileId: json.id, viewUrl: json.webViewLink };
    } catch (err) {
      console.error("[drive-upload] error:", err);
      return { ok: false as const, error: String(err) };
    }
  });
