import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAllProfiles, type Profile } from "@/lib/use-profile";
import { HomeMessageBanner } from "@/components/home-message-banner";
import { TaskCard, type TaskCardData } from "@/components/task-card";
import { AvatarCircle } from "@/components/avatar-circle";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, ListTodo, Clock, AlertTriangle, CheckCircle2, ChevronDown, Inbox } from "lucide-react";
import { formatArDate, toArabicDigits } from "@/lib/date-ar";
import type { TaskStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ai Tasks Solutions" },
      { name: "description", content: "لوحة التحكم: تابع مهام الفريق، حالة الإنجاز، والمهام المتأخرة في Ai Tasks Solutions." },
      { property: "og:title", content: "Dashboard — Ai Tasks Solutions" },
      { property: "og:description", content: "لوحة التحكم: تابع مهام الفريق، حالة الإنجاز، والمهام المتأخرة في Ai Tasks Solutions." },
      { property: "og:url", content: "https://ai-tasks-solutions.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type TaskRow = {
  id: string; title: string; status: TaskStatus;
  created_at: string; deadline: string; is_active: boolean;
  task_assignments: { user_id: string; completion_percentage: number }[];
};

function Dashboard() {
  const { data: me } = useMyProfile();
  const { data: profiles = [] } = useAllProfiles();
  const isAdmin = me?.role === "admin" || me?.role === "owner";

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["dashboard-tasks", me?.id, isAdmin],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, created_at, deadline, is_active, task_assignments(user_id, completion_percentage)")
        .eq("is_active", true)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const [filter, setFilter] = useState<"all" | "inProgress" | "late" | "done">("all");

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const total = allTasks.length;
  const inProgress = allTasks.filter((t) => t.status === "inProgress").length;
  const late = allTasks.filter((t) => t.status === "late").length;
  const done = allTasks.filter((t) => t.status === "done").length;

  const tasks = useMemo(() => {
    if (filter === "all") return allTasks;
    return allTasks.filter((t) => t.status === filter);
  }, [allTasks, filter]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {isAdmin && <HomeMessageBanner />}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatArDate(new Date())} · {toArabicDigits(total)} مهمة نشطة
          </p>
        </div>
        {isAdmin && (
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90 active:scale-95">
            <Link to="/add-task"><Plus className="h-4 w-4" />مهمة جديدة</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ListTodo}     label="إجمالي المهام" value={total}      tint="#2563EB" active={filter === "all"}        onClick={() => setFilter("all")} />
        <StatCard icon={Clock}        label="قيد التنفيذ"    value={inProgress} tint="#D97706" active={filter === "inProgress"} onClick={() => setFilter(filter === "inProgress" ? "all" : "inProgress")} />
        <StatCard icon={AlertTriangle} label="متأخرة"       value={late}       tint="#DC2626" active={filter === "late"}       onClick={() => setFilter(filter === "late" ? "all" : "late")} />
        <StatCard icon={CheckCircle2} label="منتهية"        value={done}       tint="#059669" active={filter === "done"}       onClick={() => setFilter(filter === "done" ? "all" : "done")} />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}

      {!isLoading && tasks.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">لا توجد مهام حالياً</p>
          {isAdmin && (
            <Button asChild className="mt-4 bg-primary text-primary-foreground hover:opacity-90 active:scale-95">
              <Link to="/add-task"><Plus className="h-4 w-4" />إضافة مهمة جديدة</Link>
            </Button>
          )}
        </div>
      )}

      {isAdmin ? (
        <EmployeeGrid tasks={tasks} profiles={profiles} profileById={profileById} myProfileId={me?.id ?? null} />
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
          {tasks
            .filter((t) => t.task_assignments.some((a) => a.user_id === me?.id))
            .map((t) => {
              const my = t.task_assignments.find((a) => a.user_id === me?.id);
              return (
                <TaskCard key={t.id} task={toCard(t, me!.color, my?.completion_percentage)} />
              );
            })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint, active, onClick }: { icon: typeof ListTodo; label: string; value: number; tint: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass rounded-xl p-4 flex items-center gap-3 text-right transition-all hover:-translate-y-0.5 active:scale-[0.98] w-full",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: tint + "22", color: tint }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-foreground">{toArabicDigits(value)}</div>
      </div>
    </button>
  );
}

function EmployeeGrid({ tasks, profiles, profileById, myProfileId }: {
  tasks: TaskRow[]; profiles: Profile[]; profileById: Map<string, Profile>; myProfileId: string | null;
}) {
  const employees = profiles.filter((p) => p.role === "employee");
  if (employees.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
        لا يوجد موظفون بعد. أضف زميلاً للبدء.
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
      {employees.map((emp) => {
        const empTasks = tasks.filter((t) => t.task_assignments.some((a) => a.user_id === emp.id));
        return (
          <div key={emp.id} className="glass rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-3 px-1">
              <AvatarCircle name={emp.full_name} color={emp.color} />
              <div className="leading-tight flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{emp.full_name}</div>
                <div className="text-[11px] text-muted-foreground">{toArabicDigits(empTasks.length)} مهمة</div>
              </div>
            </div>
            <div className="space-y-2">
              {empTasks.length === 0 && (
                <div className="text-xs text-muted-foreground px-1">لا مهام</div>
              )}
              {empTasks.map((t) => {
                const a = t.task_assignments.find((x) => x.user_id === emp.id);
                return <TaskCard key={t.id} task={toCard(t, emp.color, a?.completion_percentage)} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toCard(t: TaskRow, color: string, pct?: number): TaskCardData {
  return {
    id: t.id, title: t.title, status: t.status,
    created_at: t.created_at, deadline: t.deadline,
    borderColor: color, percentage: pct ?? 0,
  };
}
