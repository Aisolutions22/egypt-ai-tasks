import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { STATUS_META, type TaskStatus } from "@/lib/status";
import { formatArDate, isLate as isLateFn } from "@/lib/date-ar";

export interface TaskCardData {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
  deadline: string;
  borderColor: string;
}

export function TaskCard({ task, disableLink }: { task: TaskCardData; disableLink?: boolean }) {
  const late = task.status === "late" || (isLateFn(task.deadline) && task.status !== "closed" && task.status !== "done");
  const s = STATUS_META[task.status];
  const className = cn(
    "block glass rounded-xl p-4 transition-all",
    !disableLink && "hover:shadow-md hover:-translate-y-0.5",
    late && "late-pulse",
  );
  const style = { borderRight: `3px solid ${task.borderColor}` };
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold text-sm leading-snug line-clamp-2 flex-1">{task.title}</h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: s.color, color: s.textOn }}
        >
          {s.label}
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span>أُنشئت: {formatArDate(task.created_at)}</span>
        <span className={cn(late && "text-destructive font-bold")}>
          Deadline: {formatArDate(task.deadline)}
        </span>
      </div>
    </>
  );
  if (disableLink) {
    return <div className={className} style={style}>{inner}</div>;
  }
  return (
    <Link to="/task/$id" params={{ id: task.id }} className={className} style={style}>
      {inner}
    </Link>
  );
}
