import { createFileRoute, Link, useParams, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAllProfiles } from "@/lib/use-profile";
import { AvatarCircle } from "@/components/avatar-circle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_META, type TaskStatus } from "@/lib/status";
import { formatArDate, formatArDateTime } from "@/lib/date-ar";
import { ArrowRight, Check, Flag, Reply, X, Send, Paperclip, FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { archiveMessageToSheet } from "@/lib/sheets-archive.functions";
import { uploadDriveFile } from "@/lib/drive-upload.functions";

export const Route = createFileRoute("/_authenticated/task/$id")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: p } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
    if (p?.role === "owner") throw redirect({ to: "/dashboard" });
  },
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
type Attachment = { id: string; task_id: string; uploaded_by: string; file_name: string; drive_file_id: string | null; drive_view_url: string | null; created_at: string };
type TimelineItem = { kind: "msg"; created_at: string; msg: Msg } | { kind: "att"; created_at: string; att: Attachment };

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

  const { data: attachments = [] } = useQuery({
    queryKey: ["task-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Attachment[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("tmsg-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_messages", filter: `task_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["task-messages", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments", filter: `task_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["task-attachments", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const archiveToSheet = useServerFn(archiveMessageToSheet);
  const uploadFile = useServerFn(uploadDriveFile);
  const myAssignment = task?.task_assignments?.find((a: { user_id: string }) => a.user_id === me?.id);

  if (!task) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  const s = STATUS_META[task.status as TaskStatus];
  const closed = task.status === "closed";

  async function send() {
    if (!content.trim() || !me) return;
    const { error } = await supabase.from("task_messages").insert({
      task_id: id, sender_id: me.id, content: content.trim(), reply_to_id: replyTo?.id ?? null,
    });
    if (error) { toast.error("تعذر الإرسال"); return; }
    // Fire-and-forget archive to Google Sheets — never blocks UX
    const messageText = content.trim();
    const archiveContent = replyTo
      ? `رد على "${replyTo.content.slice(0, 60)}": ${messageText}`
      : messageText;
    archiveToSheet({
      data: {
        taskTitle: task?.title ?? "",
        taskDetails: "",
        type: "رسالة",
        senderName: me.full_name,
        content: archiveContent,
        whenText: formatArDateTime(new Date()),
      },
    }).catch(() => {});
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
    archiveToSheet({
      data: {
        taskTitle: task?.title ?? "",
        taskDetails: "",
        type: "تم الإغلاق",
        senderName: me.full_name,
        content: "",
        whenText: formatArDateTime(new Date()),
      },
    }).catch(() => {});
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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الملف أكبر من ٨ ميجا");
      return;
    }
    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const idx = result.indexOf(",");
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await uploadFile({
        data: {
          taskTitle: task?.title ?? "",
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          base64Data,
        },
      });
      if (!res.ok) {
        toast.error("فشل رفع الملف");
        return;
      }
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: id,
        uploaded_by: me.id,
        file_name: file.name,
        file_url: res.viewUrl,
        drive_file_id: res.driveFileId,
        drive_view_url: res.viewUrl,
      });
      if (insErr) {
        toast.error("فشل حفظ المرفق");
        return;
      }
      toast.success("تم رفع الملف ✓");
      qc.invalidateQueries({ queryKey: ["task-attachments", id] });
    } catch {
      toast.error("فشل رفع الملف");
    } finally {
      setUploading(false);
    }
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
            {task.task_assignments?.map((a: { id: string; user_id: string }) => {
              const p = profileById.get(a.user_id);
              if (!p) return null;
              return (
                <span key={a.id} className="inline-flex items-center gap-1.5 bg-accent rounded-full pl-3 pr-1 py-0.5">
                  <span>{p.full_name}</span>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs mb-1.5">التواريخ</div>
          <div>تاريخ الإنشاء: {formatArDateTime(task.created_at)}</div>
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
          {messages.length === 0 && attachments.length === 0 && (
            <div className="text-sm text-muted-foreground">لا توجد رسائل بعد</div>
          )}
          {([
            ...messages.map((m) => ({ kind: "msg" as const, created_at: m.created_at, msg: m })),
            ...attachments.map((a) => ({ kind: "att" as const, created_at: a.created_at, att: a })),
          ] as TimelineItem[])
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((item) => {
              if (item.kind === "msg") {
                const m = item.msg;
                const sender = profileById.get(m.sender_id);
                const isMine = m.sender_id === me?.id;
                const replied = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                return (
                  <div key={`m-${m.id}`} className="flex gap-2.5">
                    <AvatarCircle name={sender?.full_name ?? "؟"} color={sender?.color ?? "#999"} avatarUrl={sender?.avatar_url} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm" style={{ color: sender?.color }}>{sender?.full_name}</span>
                        <span className="text-[11px] text-muted-foreground">{formatArDateTime(m.created_at)}</span>
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
              }
              const a = item.att;
              const up = profileById.get(a.uploaded_by);
              const href = a.drive_view_url ?? "";
              return (
                <div key={`a-${a.id}`} className="flex gap-2.5">
                  <AvatarCircle name={up?.full_name ?? "؟"} color={up?.color ?? "#999"} avatarUrl={up?.avatar_url} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm" style={{ color: up?.color }}>{up?.full_name}</span>
                      <span className="text-[11px] text-muted-foreground">{formatArDateTime(a.created_at)}</span>
                    </div>
                    <div className="mt-1 inline-flex items-center gap-3 rounded-xl border bg-accent/40 px-3 py-2 max-w-full">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1 min-w-0">{a.file_name}</span>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />فتح الملف
                        </a>
                      )}
                    </div>
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="اكتب ردك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)" rows={3}
            />
            <div className="flex justify-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="إرفاق ملف PDF"
                title="إرفاق ملف PDF"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {uploading ? "جاري الرفع..." : "إرفاق PDF"}
              </Button>
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
