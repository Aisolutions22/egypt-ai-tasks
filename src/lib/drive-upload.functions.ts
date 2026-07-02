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

export const uploadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      if (data.base64Data.length * 0.75 > 100 * 1024 * 1024) {
        return { ok: false as const, error: "الملف كبير جداً" };
      }

      const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
      const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
      if (!scriptUrl || !scriptSecret) {
        console.error("[drive-upload] missing GOOGLE_APPS_SCRIPT_URL / GOOGLE_APPS_SCRIPT_SECRET");
        return { ok: false as const, error: "إعدادات Drive غير مكتملة" };
      }

      const dotIdx = data.fileName.lastIndexOf(".");
      const fileExtension = dotIdx >= 0 ? data.fileName.slice(dotIdx) : "";
      const companyName = data.taskTitle;

      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: scriptSecret,
          displayName: data.displayName,
          companyName,
          extension: fileExtension,
          mimeType: data.mimeType,
          base64Data: data.base64Data,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        console.error(`[drive-upload] apps-script ${res.status}: ${text}`);
        return { ok: false as const, error: `upload ${res.status}` };
      }

      let json: { ok: boolean; fileId?: string; viewUrl?: string; fileName?: string; error?: string; errorCode?: string };
      try {
        json = JSON.parse(text);
      } catch {
        console.error(`[drive-upload] non-JSON response: ${text}`);
        return { ok: false as const, error: "استجابة غير صالحة من خادم الرفع" };
      }

      if (!json.ok) {
        console.error(`[drive-upload] apps-script error ${json.errorCode ?? ""}: ${json.error ?? ""}`);
        return { ok: false as const, error: json.error || "فشل الرفع" };
      }

      return {
        ok: true as const,
        driveFileId: json.fileId!,
        viewUrl: json.viewUrl!,
      };
    } catch (err) {
      console.error("[drive-upload] error:", err);
      return { ok: false as const, error: String(err) };
    }
  });
