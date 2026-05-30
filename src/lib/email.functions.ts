import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string(),
  })).min(1).max(50),
  task_title: z.string().min(1).max(200),
  deadline_iso: z.string().min(1),
});

/**
 * Sends a "new task" email via Resend.
 * Silently no-ops if RESEND_API_KEY is not configured, so the app
 * still works end-to-end before email is wired.
 */
export const sendNewTaskEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { ok: true, skipped: true, reason: "RESEND_API_KEY not configured" };
    }

    const sent: Array<{ email: string; ok: boolean }> = [];
    for (const r of data.recipients) {
      const body = {
        from: "Ai Tasks Solutions <onboarding@resend.dev>",
        to: [r.email],
        subject: "تاسك جديد بانتظارك — Ai Tasks Solutions",
        html: `
<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;background:#FFF5F0;padding:24px;color:#1A1A2E">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #f0e3da">
    <h2 style="color:#FF6B2B;margin:0 0 12px">مرحباً ${escapeHtml(r.name)}،</h2>
    <p style="margin:0 0 16px">تم تكليفك بمهمة جديدة:</p>
    <p style="font-weight:700;font-size:18px;margin:0 0 8px">${escapeHtml(data.task_title)}</p>
    <p style="margin:0 0 16px">الـ Deadline: ${escapeHtml(new Date(data.deadline_iso).toLocaleString("ar"))}</p>
    <p style="margin:0">يرجى الدخول لعرض التفاصيل.</p>
  </div>
</div>`,
      };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(body),
        });
        sent.push({ email: r.email, ok: res.ok });
      } catch {
        sent.push({ email: r.email, ok: false });
      }
    }
    return { ok: true, sent };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
