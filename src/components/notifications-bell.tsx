import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/lib/use-profile";
import { formatArRelative } from "@/lib/date-ar";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  recipient_id: string;
  task_id: string | null;
  type: "new_task" | "task_done" | "task_late" | "new_message";
  message: string;
  is_read: boolean;
  created_at: string;
};

const TYPE_COLOR: Record<Notif["type"], string> = {
  new_task: "#2563EB",
  task_done: "#059669",
  task_late: "#DC2626",
  new_message: "#FF6B2B",
};

export function NotificationsBell() {
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel("notif-" + me.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${me.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", me.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id, qc]);

  const unread = notifs.filter((n) => !n.is_read).length;

  async function openOne(n: Notif) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    qc.invalidateQueries({ queryKey: ["notifications", me?.id] });
    if (n.task_id) navigate({ to: "/task/$id", params: { id: n.task_id } });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="إشعارات"
          className="relative h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-accent"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center">
              {unread > 9 ? "٩+" : String(unread).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d])}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
        <div className="px-3 py-2 font-semibold text-sm border-b">الإشعارات</div>
        {notifs.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">لا توجد إشعارات بعد</div>
        )}
        {notifs.map((n) => (
          <button
            key={n.id}
            onClick={() => openOne(n)}
            className={cn(
              "w-full text-right flex items-start gap-2 p-3 hover:bg-accent transition-colors border-b last:border-0",
              !n.is_read && "bg-accent/40",
            )}
          >
            <span
              className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: TYPE_COLOR[n.type] }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-snug">{n.message}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {formatArRelative(n.created_at)}
              </div>
            </div>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
