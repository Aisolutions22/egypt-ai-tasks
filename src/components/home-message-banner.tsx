import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/lib/use-profile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatArDateTime } from "@/lib/date-ar";

type HM = {
  id: string;
  content: string;
  created_by: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
};

export function HomeMessageBanner() {
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: msgs = [] } = useQuery({
    queryKey: ["home-messages"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("home_messages")
        .select("*")
        .eq("is_active", true)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HM[];
    },
    refetchInterval: 60_000,
  });

  if (msgs.length === 0) return null;
  const latest = msgs[0];
  const isAdmin = me?.role === "admin" || me?.role === "owner";

  async function dismiss(id: string) {
    await supabase.from("home_messages").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["home-messages"] });
  }

  return (
    <>
      <div
        className="rounded-2xl p-4 md:p-5 text-white shadow-lg flex items-center gap-3"
        style={{ background: "linear-gradient(135deg,#FF6B2B,#FF9A5C)" }}
      >
        <span className="px-2.5 py-1 rounded-full bg-white/25 text-xs font-bold shrink-0">
          Home Message
        </span>
        <div className="flex-1 font-medium leading-relaxed">{latest.content}</div>
        {msgs.length > 1 && (
          <button
            onClick={() => setShowAll(true)}
            className="px-2.5 py-1 rounded-full bg-white/25 text-xs font-bold hover:bg-white/35"
          >
            +{String(msgs.length - 1).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d])} أخرى
          </button>
        )}
        {isAdmin && (
          <button
            aria-label="إخفاء"
            onClick={() => dismiss(latest.id)}
            className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>كل الرسائل النشطة</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {msgs.map((m) => (
              <div key={m.id} className="rounded-xl border p-3 bg-accent/30">
                <div className="text-sm">{m.content}</div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  أُضيفت {formatArDateTime(m.created_at)}
                </div>
                {isAdmin && (
                  <button
                    className="mt-2 text-xs text-destructive hover:underline"
                    onClick={() => dismiss(m.id)}
                  >
                    إخفاء
                  </button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
