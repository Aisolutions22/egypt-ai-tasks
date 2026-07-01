import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccessToken } from "./sheets-archive.functions";

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

export const uploadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      if (data.base64Data.length * 0.75 > 8 * 1024 * 1024) {
        return { ok: false as const, error: "الملف كبير جداً" };
      }
      const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!saJson || !folderId) {
        console.error("[drive-upload] missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_FOLDER_ID");
        return { ok: false as const, error: "إعدادات Drive غير مكتملة" };
      }
      const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
      const accessToken = await getAccessToken(
        sa.client_email,
        sa.private_key,
        "https://www.googleapis.com/auth/drive.file",
      );

      const metadata = {
        name: `${data.taskTitle} - ${data.fileName}`,
        parents: [folderId.trim()],
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
