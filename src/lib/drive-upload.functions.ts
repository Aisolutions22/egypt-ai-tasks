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
      const dotIdx = data.fileName.lastIndexOf(".");
      const fileExtension = dotIdx >= 0 ? data.fileName.slice(dotIdx) : "";
      const companyName = data.taskTitle;

      const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
      const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

      console.log("[drive-upload][diag] upload started", {
        displayName: data.displayName,
        companyName,
        extension: fileExtension,
        mimeType: data.mimeType,
        base64Length: data.base64Data.length,
        finalFileName: data.fileName,
        hasScriptUrl: Boolean(scriptUrl),
        hasScriptSecret: Boolean(scriptSecret),
      });

      if (data.base64Data.length * 0.75 > 100 * 1024 * 1024) {
        return { ok: false as const, error: "الملف كبير جداً" };
      }

      if (!scriptUrl || !scriptSecret) {
        console.error("[drive-upload] missing GOOGLE_APPS_SCRIPT_URL / GOOGLE_APPS_SCRIPT_SECRET");
        return { ok: false as const, error: "إعدادات Drive غير مكتملة" };
      }

      let urlOrigin = "";
      let urlPathname = scriptUrl;
      try {
        const u = new URL(scriptUrl);
        urlOrigin = u.origin;
        urlPathname = u.pathname;
      } catch {}
      console.log("[drive-upload][diag] before fetch", {
        urlOrigin,
        urlPathname,
      });

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

      console.log("[drive-upload][diag] response headers", {
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
      });

      const text = await res.text();
      console.log("[drive-upload][diag] raw body", text.slice(0, 2000));

      if (!res.ok) {
        console.error("[drive-upload][diag] non-200", {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers as unknown as Iterable<[string, string]>),
          rawBody: text.slice(0, 2000),
        });
        return { ok: false as const, error: `upload ${res.status}` };
      }

      let json: { ok: boolean; fileId?: string; viewUrl?: string; fileName?: string; error?: string; errorCode?: string };
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error("[drive-upload][diag] JSON parse error", {
          message: (parseErr as Error).message,
          bodySnippet: text.slice(0, 500),
        });
        return { ok: false as const, error: "استجابة غير صالحة من خادم الرفع" };
      }

      console.log("[drive-upload][diag] parsed json", {
        ok: json.ok,
        error: json.error,
        errorCode: json.errorCode,
        fileId: json.fileId,
        viewUrl: json.viewUrl,
        fileName: json.fileName,
      });

      if (!json.ok) {
        console.error("[drive-upload][diag] apps-script ok:false", json);
        return { ok: false as const, error: json.error || "فشل الرفع" };
      }

      console.log("[drive-upload][diag] upload completed successfully", {
        fileId: json.fileId,
        viewUrl: json.viewUrl,
      });

      return {
        ok: true as const,
        driveFileId: json.fileId!,
        viewUrl: json.viewUrl!,
      };
    } catch (err) {
      const e = err as Error;
      console.error("[drive-upload][diag] thrown exception", {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
      });
      return { ok: false as const, error: String(err) };
    }
  });


