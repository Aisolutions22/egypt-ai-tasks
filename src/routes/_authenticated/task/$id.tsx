import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAllProfiles } from "@/lib/use-profile";
import { AvatarCircle } from "@/components/avatar-circle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { STATUS_META, type TaskStatus } from "@/lib/status";
import { formatArDate, formatArDateTime, formatArTime, toArabicDigits } from "@/lib/date-ar";
import { ArrowRight, Check, Flag, Reply, X, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/task/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المهمة — Ai Tasks Solutions" },
      { name: "description", content: "اعرض تفاصيل المهمة، حالة الإنجاز، المحادثة بين الفريق، والمرفقات في Ai Tasks Solutions." },
      { property: "og:title", content: "تفاصيل المهمة — Ai Tasks Solutions" },
      { property: "og:description", content: "اعرض تفاصيل المهمة، حالة الإنجاز، المحادثة بين الفريق، والمرفقات في Ai Tasks Solutions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TaskDetail,
});

type Msg = { id: string; task_id: string; sender_id: string; content: string; reply_to_id: string | null; created_at: string };

function TaskDetail() {
  const { id } = useParams({ from: "/_authenticated/task/$id" });
  const qc = useQueryClient();
  const { data: me } = useMyProfile();
  const { data: profiles = [] } = useAllProfiles();
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const isAdmin = me?.role === "admin";
  const isOwner = me?.role === "owner";


  const { data: task } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_assignments(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["task-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_messages")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("tmsg-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_messages", filter: `task_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["task-messages", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const myAssignment = task?.task_assignments?.find((a: { user_id: string }) => a.user_id === me?.id);
  const [pct, setPct] = useState<number>(myAssignment?.completion_percentage ?? 0);

  useEffect(() => {
    if (myAssignment) setPct(myAssignment.completion_percentage);
  }, [myAssignment?.completion_percentage]);

  if (!task) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  const s = STATUS_META[task.status as TaskStatus];
  const closed = task.status === "closed";

  async function send() {
    if (!content.trim() || !me) return;
    const { error } = await supabase.from("task_messages").insert({
      task_id: id, sender_id: me.id, content: content.trim(), reply_to_id: replyTo?.id ?? null,
    });
    if (error) { toast.error("تعذر الإرسال"); return; }
    // Update assignment percentage if employee
    if (myAssignment && pct !== myAssignment.completion_percentage) {
      await supabase.from("task_assignments")
        .update({ completion_percentage: pct, employee_status: pct >= 100 ? "done" : "inProgress" })
        .eq("id", myAssignment.id);
      qc.invalidateQueries({ queryKey: ["task", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    }
    // Notify admins on employee message
    if (me.role === "employee") {
      const admins = profiles.filter((p) => p.role === "admin" || p.role === "owner");
      if (admins.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            recipient_id: a.id, task_id: id, type: "new_message" as const,
            message: `${me.full_name} أرسل رسالة في: ${task?.title ?? ""}`,
          })),
        );
      }
    }
    setContent(""); setReplyTo(null);
  }

  async function markDone() {
    if (!me) return;
    if (!confirm("هل أنت متأكد من إغلاق هذه المهمة؟")) return;
    await supabase.from("tasks")
      .update({ status: "closed", is_active: false, closed_by: me.id, closed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("تم الإغلاق ✓");
    qc.invalidateQueries({ queryKey: ["task", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
  }
  async function markLate() {
    if (!task) return;
    await supabase.from("tasks").update({ status: "late" }).eq("id", id);
    toast.success("تم تعليمه كمتأخر");
    const assignees = task.task_assignments?.map((a: { user_id: string }) => a.user_id) ?? [];
    if (assignees.length) {
      await supabase.from("notifications").insert(
        assignees.map((uid: string) => ({
          recipient_id: uid, task_id: id, type: "task_late" as const,
          message: `تم تعليم المهمة "${task.title}" كمتأخر`,
        })),
      );
    }
    qc.invalidateQueries({ queryKey: ["task", id] });
  }


  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass rounded-2xl p-4 md:p-5 flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard"><ArrowRight className="h-4 w-4" />رجوع</Link>
        </Button>
        <h1 className="text-lg md:text-xl font-bold flex-1 min-w-0">{task.title}</h1>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: s.color, color: s.textOn }}>
          {s.label}
        </span>
        {isAdmin && !closed && (
          <div className="flex gap-2">
            <Button size="sm" onClick={markDone} className="bg-success text-white hover:opacity-90">
              <Check className="h-4 w-4" />Done
            </Button>
            <Button size="sm" onClick={markLate} variant="destructive">
              <Flag className="h-4 w-4" />متأخر
            </Button>
          </div>
        )}
      </div>

      {closed && task.closed_at && (
        <div className="glass rounded-2xl p-3 md:p-4 text-sm text-muted-foreground">
          أُغلق بواسطة {profileById.get(task.closed_by ?? "")?.full_name ?? "—"} في {formatArDateTime(task.closed_at)}
        </div>
      )}

      {/* Info */}
      <div className="glass rounded-2xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground text-xs mb-1.5">منسوب إلى</div>
          <div className="flex flex-wrap gap-2">
            {task.task_assignments?.map((a: { id: string; user_id: string; completion_percentage: number }) => {
              const p = profileById.get(a.user_id);
              if (!p) return null;
              return (
                <span key={a.id} className="inline-flex items-center gap-1.5 bg-accent rounded-full pl-3 pr-1 py-0.5">
                  <span>{p.full_name}</span>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                  <span className="text-[11px] bg-primary/15 text-primary px-1.5 rounded-full">{toArabicDigits(a.completion_percentage)}%</span>
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs mb-1.5">التواريخ</div>
          <div>تاريخ الإنشاء: {formatArDate(task.created_at)}</div>
          <div className="text-warning">Deadline: {formatArDate(task.deadline)}</div>
        </div>
        {task.description && (
          <div className="md:col-span-2">
            <div className="text-muted-foreground text-xs mb-1.5">التفاصيل</div>
            <div className="whitespace-pre-wrap leading-relaxed">{task.description}</div>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3">
        <div className="font-bold">المحادثة</div>
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {messages.length === 0 && <div className="text-sm text-muted-foreground">لا توجد رسائل بعد</div>}
          {messages.map((m) => {
            const sender = profileById.get(m.sender_id);
            const isMine = m.sender_id === me?.id;
            const replied = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            return (
              <div key={m.id} className="flex gap-2.5">
                <AvatarCircle name={sender?.full_name ?? "؟"} color={sender?.color ?? "#999"} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm" style={{ color: sender?.color }}>{sender?.full_name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatArDateTime(m.created_at)} · {formatArTime(m.created_at)}
                    </span>
                  </div>
                  {replied && (
                    <div className="mt-1 text-xs bg-accent/50 border-r-2 border-primary px-2 py-1 rounded text-muted-foreground line-clamp-2">
                      {replied.content}
                    </div>
                  )}
                  <div className={cn(
                    "mt-1 rounded-xl px-3 py-2 text-sm inline-block max-w-full text-foreground",
                    isMine ? "bg-primary/10" : "bg-accent",
                  )}>
                    {m.content}
                  </div>
                  <button
                    className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-1"
                    onClick={() => setReplyTo(m)}
                  >
                    <Reply className="h-3 w-3" />رد
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!closed && (
          <div className="border-t pt-3 space-y-2">
            {replyTo && (
              <div className="flex items-start gap-2 bg-accent/40 rounded-lg px-3 py-2 text-xs">
                <div className="flex-1 line-clamp-2 text-muted-foreground">رد على: {replyTo.content}</div>
                <button onClick={() => setReplyTo(null)} aria-label="إلغاء الرد"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <Textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب ردك هنا..." rows={3}
            />
            {myAssignment && (
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">نسبة الإنجاز</span>
                  <span className="font-bold">{toArabicDigits(pct)}%</span>
                </div>
                <Slider value={[pct]} max={100} step={1} onValueChange={(v) => setPct(v[0])} />
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={send} disabled={!content.trim()} className="bg-primary text-primary-foreground">
                <Send className="h-4 w-4" />إرسال
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
