import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAllProfiles } from "@/lib/use-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/color-picker";
import { AvatarCircle } from "@/components/avatar-circle";
import { deleteColleague } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Trash2, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ai Tasks Solutions" },
      { name: "description", content: "إدارة ملفك الشخصي، الإعدادات العامة، وإدارة الزملاء في Ai Tasks Solutions." },
      { property: "og:title", content: "Settings — Ai Tasks Solutions" },
      { property: "og:description", content: "إدارة ملفك الشخصي، الإعدادات العامة، وإدارة الزملاء في Ai Tasks Solutions." },
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
  const del = useServerFn(deleteColleague);
  const isAdmin = me?.role === "admin" || me?.role === "owner";
  const isOwner = me?.role === "owner";

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
      return toast.error("هذا اللون محجوز لزميل آخر");
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

  async function removeColleague(id: string, full_name: string) {
    if (!confirm(`حذف ${full_name}؟ هذا إجراء نهائي.`)) return;
    try { await del({ data: { profile_id: id } }); toast.success("تم الحذف"); qc.invalidateQueries(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">حسابي</h2>
        <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div>
        <div>
          <Label>اللون</Label>
          <div className="mt-2"><ColorPicker value={color} onChange={setColor} takenColors={profiles.map((p) => p.color)} allowSelf={me?.color} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={saveProfile} className="bg-primary text-primary-foreground">حفظ</Button></div>
      </section>

      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">تغيير كلمة المرور</h2>
        <Input type="password" placeholder="الحالية (غير مطلوبة هنا)" dir="ltr" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
        <Input type="password" placeholder="الجديدة" dir="ltr" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <Input type="password" placeholder="تأكيد الجديدة" dir="ltr" value={confPw} onChange={(e) => setConfPw(e.target.value)} />
        <div className="flex justify-end"><Button onClick={changePassword} variant="secondary">تغيير</Button></div>
      </section>

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

      {isAdmin && (
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

      {isAdmin && (
        <section className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">الزملاء</h2>
            <Button asChild size="sm" variant="secondary"><a href="/add-colleague">إضافة زميل</a></Button>
          </div>
          <div className="divide-y">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <AvatarCircle name={p.full_name} color={p.color} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.role === "owner" ? "Owner" : p.role === "admin" ? "Admin" : "موظف"}
                  </div>
                </div>
                {isOwner && p.role !== "owner" && (
                  <Button size="icon" variant="ghost" onClick={() => removeColleague(p.id, p.full_name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
