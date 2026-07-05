import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  to: z.string().email(),
  name: z.string(),
  taskTitle: z.string(),
  deadlineText: z.string(),
});

export const sendTaskEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const url = process.env.GOOGLE_APPS_SCRIPT_URL;
      const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
      if (!url || !secret) return { ok: false };

      const htmlBody = `<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif">
        <h2>مرحباً ${data.name}،</h2>
        <p>تم تكليفك بمهمة جديدة: <strong>${data.taskTitle}</strong></p>
        <p>الموعد النهائي: ${data.deadlineText}</p>
        <p>يرجى الدخول لعرض التفاصيل.</p></div>`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          action: "sendEmail",
          to: data.to,
          subject: "مهمة جديدة بانتظارك",
          htmlBody,
        }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  });
