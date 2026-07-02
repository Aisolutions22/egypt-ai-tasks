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

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export const uploadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const dotIdx = data.fileName.lastIndexOf(".");
      const fileExtension = dotIdx >= 0 ? data.fileName.slice(dotIdx) : "";

      const { data: settings } = await context.supabase
        .from("app_settings")
        .select("company_name")
        .eq("id", 1)
        .single();
      const companyName =
        (settings as { company_name?: string } | null)?.company_name ??
        "Ai Tasks Solutions";

      const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
      const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

      if (data.base64Data.length * 0.75 > 100 * 1024 * 1024) {
        return { ok: false as const, error: "الملف كبير جداً" };
      }

      if (!scriptUrl || !scriptSecret) {
        console.error("[drive-upload] missing GOOGLE_APPS_SCRIPT_URL / GOOGLE_APPS_SCRIPT_SECRET");
        return { ok: false as const, error: "إعدادات Drive غير مكتملة" };
      }

      const body = JSON.stringify({
        secret: scriptSecret,
        displayName: data.displayName,
        companyName,
        extension: fileExtension,
        mimeType: data.mimeType,
        base64Data: data.base64Data,
      });

      const doFetch = async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
          return await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      };

      let res: Response;
      try {
        res = await doFetch();
        if (RETRYABLE_STATUSES.has(res.status)) {
          try {
            res = await doFetch();
          } catch {
            return { ok: false as const, error: "فشل رفع الملف، حاول مرة أخرى" };
          }
        }
      } catch {
        try {
          res = await doFetch();
        } catch {
          return { ok: false as const, error: "فشل رفع الملف، حاول مرة أخرى" };
        }
      }

      const text = await res.text();

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

      if (!json.ok) {
        console.error("[drive-upload][diag] apps-script ok:false", json);
        return { ok: false as const, error: json.error || "فشل الرفع" };
      }

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
