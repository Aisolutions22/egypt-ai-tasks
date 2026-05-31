import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllProfiles } from "@/lib/use-profile";
import { Input } from "@/components/ui/input";
import { AvatarCircle } from "@/components/avatar-circle";
import { formatArDate, formatArDateTime } from "@/lib/date-ar";
import { Search, ArchiveX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/archive")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: p } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
    if (!p || (p.role !== "admin" && p.role !== "owner")) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Archive — Ai Tasks Solutions" },
      { name: "description", content: "تصفح أرشيف المهام المغلقة، ابحث وراجع سجل الفريق في Ai Tasks Solutions." },
      { property: "og:title", content: "Archive — Ai Tasks Solutions" },
      { property: "og:description", content: "تصفح أرشيف المهام المغلقة، ابحث وراجع سجل الفريق في Ai Tasks Solutions." },
      { property: "og:url", content: "https://ai-tasks-solutions.lovable.app/archive" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { data: profiles = [] } = useAllProfiles();
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const [q, setQ] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["archive-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, created_at, deadline, closed_by, closed_at, task_assignments(user_id)")
        .eq("status", "closed")
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = tasks.filter((t) => {
    if (!q.trim()) return true;
    const ql = q.toLowerCase();
    if (t.title.toLowerCase().includes(ql)) return true;
    return t.task_assignments?.some((a: { user_id: string }) =>
      profileById.get(a.user_id)?.full_name.toLowerCase().includes(ql),
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Archive</h1>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ابحث عن مهمة أو موظف..." className="pr-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <ArchiveX className="h-10 w-10 mx-auto mb-2 opacity-50" />
          لا توجد مهام مؤرشفة
        </div>
      ) : (
        <div className="glass rounded-2xl divide-y">
          {filtered.map((t) => (
            <Link key={t.id} to="/task/$id" params={{ id: t.id }}
              className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {t.task_assignments?.slice(0, 3).map((a: { user_id: string }) => {
                  const p = profileById.get(a.user_id);
                  return p ? <AvatarCircle key={a.user_id} name={p.full_name} color={p.color} size={28} /> : null;
                })}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground">{formatArDate(t.created_at)}</div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Done</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
