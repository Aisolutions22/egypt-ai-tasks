import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["owner", "admin", "employee"]);

const CreateColleagueInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(120),
  role: RoleSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

async function assertRole(userId: string, allowed: Array<"owner" | "admin">) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("الحساب غير مفعّل");
  if (!allowed.includes(data.role as "owner" | "admin")) {
    throw new Error("ليس لديك الصلاحية");
  }
  return data.role as "owner" | "admin";
}

export const createColleague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateColleagueInput.parse(d))
  .handler(async ({ data, context }) => {
    const callerRole = await assertRole(context.userId, ["owner", "admin"]);
    if (data.role === "owner" && callerRole !== "owner") {
      throw new Error("لا يمكن لمشرف إنشاء حساب مالك");
    }

    // Color uniqueness
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("color", data.color)
      .limit(1);
    if (taken && taken.length > 0) throw new Error("هذا اللون محجوز لموظف آخر");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "فشل إنشاء الحساب");

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      user_id: created.user.id,
      full_name: data.full_name,
      role: data.role,
      color: data.color,
      email: data.email,
    });
    if (pErr) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }
    return { ok: true };
  });

const OffboardInput = z.object({ profile_id: z.string().uuid() });

export const offboardColleague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OffboardInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["admin"]);
    const { data: target, error } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, role")
      .eq("id", data.profile_id)
      .maybeSingle();
    if (error || !target) throw new Error("الموظف غير موجود");
    if (target.role === "owner") throw new Error("لا يمكن إقالة حساب المالك");

    const { error: bErr } = await supabaseAdmin.auth.admin.updateUserById(
      target.user_id,
      { ban_duration: "876600h" },
    );
    if (bErr) throw new Error(bErr.message);

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", data.profile_id);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });

const ResetPwInput = z.object({
  profile_id: z.string().uuid(),
  password: z.string().min(8).max(72),
});

export const resetColleaguePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetPwInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["admin"]);
    const { data: target, error } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, role")
      .eq("id", data.profile_id)
      .maybeSingle();
    if (error || !target) throw new Error("الموظف غير موجود");



    

    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(
      target.user_id,
      { password: data.password },
    );
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const backfillProfileEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.userId, ["admin"]);
    const { data: missing, error } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id")
      .is("email", null);
    if (error) throw new Error(error.message);
    if (!missing || missing.length === 0) return { ok: true, updated: 0 };

    const { data: list, error: lErr } = await supabaseAdmin.auth.admin.listUsers();
    if (lErr) throw new Error(lErr.message);
    const emailByUserId = new Map<string, string>();
    for (const u of list.users) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }

    let updated = 0;
    for (const p of missing) {
      const email = emailByUserId.get(p.user_id);
      if (!email) continue;
      const { error: uErr } = await supabaseAdmin
        .from("profiles")
        .update({ email })
        .eq("id", p.id);
      if (!uErr) updated++;
    }
    return { ok: true, updated };
  });


