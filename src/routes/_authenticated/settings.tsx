import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAllProfiles } from "@/lib/use-profile";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/color-picker";
import { AvatarCircle } from "@/components/avatar-circle";
import { offboardColleague, resetColleaguePassword } from "@/lib/admin.functions";
import { toast } from "sonner";
import { UserX, Moon, Sun, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ai Tasks Solutions" },
      { name: "description", content: "إدارة ملفك الشخصي، الإعدادات العامة، وإدارة الموظفين في Ai Tasks Solutions." },
      { property: "og:title", content: "Settings — Ai Tasks Solutions" },
      { property: "og:description", content: "إدارة ملفك الشخصي، الإعدادات العامة، وإدارة الموظفين في Ai Tasks Solutions." },
      { property: "og:url", content: "https://ai-tasks-solutions.lovable.app/settings" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me } = useMyProfile();
  const { data: profiles = [] } = useAllProfiles();
  const qc = useQueryClient();
  const offboard = useServerFn(offboardColleague);
  const resetPw = useServerFn(resetColleaguePassword);
  const isAdmin = me?.role === "admin" || me?.role === "owner";
  const isAdminOnly = me?.role === "admin";

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (me) { setName(me.full_name); setColor(me.color); }
  }, [me?.id]);

  useEffect(() => {
    const v = typeof window !== "undefined" && localStorage.getItem("theme") === "dark";
    setDark(v);
    if (v) document.documentElement.classList.add("dark");
  }, []);

  function toggleDark() {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const { data: settings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [defaultDays, setDefaultDays] = useState(2);
  useEffect(() => { if (settings) setDefaultDays(settings.default_deadline_days); }, [settings?.default_deadline_days]);

  async function saveProfile() {
    if (!me || !color) return;
    if (color !== me.color && profiles.some((p) => p.color === color && p.id !== me.id)) {
      return toast.error("هذا اللون محجوز لموظف آخر");
    }
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), color }).eq("id", me.id);
    if (error) toast.error(error.message); else { toast.success("تم الحفظ ✓"); qc.invalidateQueries(); }
  }

  async function changePassword() {
    if (newPw.length < 8) return toast.error("٨ أحرف على الأقل");
    if (newPw !== confPw) return toast.error("التأكيد غير مطابق");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) toast.error(error.message); else { toast.success("تم تغيير كلمة المرور"); setCurPw(""); setNewPw(""); setConfPw(""); }
  }

  async function saveSettings(days: number) {
    await supabase.from("app_settings").update({ default_deadline_days: days }).eq("id", 1);
    toast.success("تم الحفظ ✓");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  }

  async function offboardCol(id: string, full_name: string) {
    if (!confirm(`إقالة ${full_name}؟ سيُمنع من تسجيل الدخول لكن بياناته ومهامه ستبقى محفوظة.`)) return;
    try { await offboard({ data: { profile_id: id } }); toast.success("تمت الإقالة"); qc.invalidateQueries(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }

  async function resetColleaguePw(id: string, full_name: string) {
    const pw = prompt(`كلمة المرور الجديدة للموظف ${full_name} (8 أحرف على الأقل):`);
    if (!pw) return;
    if (pw.length < 8) return toast.error("٨ أحرف على الأقل");
    try {
      await resetPw({ data: { profile_id: id, password: pw } });
      toast.success(`تم تعيين كلمة المرور. شاركها مع ${full_name}: ${pw}`, { duration: 10000 });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }


  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">حسابي</h2>
        <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div>
        <div>
          <Label>اللون</Label>
          <div className="mt-2"><ColorPicker value={color} onChange={setColor} takenColors={profiles.filter((p) => p.is_active).map((p) => p.color)} allowSelf={me?.color} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={saveProfile} className="bg-primary text-primary-foreground">حفظ</Button></div>
      </section>

      {me?.role !== "owner" && (
        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">تغيير كلمة المرور</h2>
          <PasswordInput placeholder="الحالية (غير مطلوبة هنا)" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          <PasswordInput placeholder="الجديدة" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <PasswordInput placeholder="تأكيد الجديدة" value={confPw} onChange={(e) => setConfPw(e.target.value)} />
          <div className="flex justify-end"><Button onClick={changePassword} variant="secondary">تغيير</Button></div>
        </section>
      )}

      <section className="glass rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {dark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          <div>
            <div className="font-bold">المظهر</div>
            <div className="text-xs text-muted-foreground">{dark ? "وضع داكن" : "وضع فاتح"}</div>
          </div>
        </div>
        <Button onClick={toggleDark} variant="outline">{dark ? "تفعيل الفاتح" : "تفعيل الداكن"}</Button>
      </section>

      {isAdminOnly && (
        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">إعدادات النظام</h2>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <Label>Default Deadline Days</Label>
              <span className="font-bold">{defaultDays}</span>
            </div>
            <Slider min={1} max={7} step={1} value={[defaultDays]}
              onValueChange={(v) => setDefaultDays(v[0])}
              onValueCommit={(v) => saveSettings(v[0])} />
          </div>
        </section>
      )}

      {isAdminOnly && (
        <section className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">الموظفون</h2>
            <Button asChild size="sm" variant="secondary"><a href="/add-colleague">إضافة موظف</a></Button>
          </div>
          <div className="divide-y">
            {profiles.filter((p) => p.is_active).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <AvatarCircle name={p.full_name} color={p.color} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.role === "owner" ? "Owner" : p.role === "admin" ? "Admin" : "موظف"}
                  </div>
                </div>
                {isAdminOnly && (
                  <Button size="icon" variant="ghost" onClick={() => resetColleaguePw(p.id, p.full_name)} title="إعادة تعيين كلمة المرور">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                )}
                {isAdminOnly && p.role !== "owner" && (
                  <Button size="icon" variant="ghost" onClick={() => offboardCol(p.id, p.full_name)} title="إقالة الزميل">
                    <UserX className="h-4 w-4 text-destructive" />
                  </Button>
                )}

              </div>
            ))}
          </div>
          {profiles.some((p) => !p.is_active) && (
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">موظفون سابقون</summary>
              <div className="divide-y mt-2">
                {profiles.filter((p) => !p.is_active).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 opacity-70">
                    <AvatarCircle name={p.full_name} color={p.color} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.full_name}</div>
                    </div>
                    <span className="text-xs rounded-full bg-accent px-2 py-0.5">
                      {p.role === "admin" ? "Admin" : "موظف"}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
