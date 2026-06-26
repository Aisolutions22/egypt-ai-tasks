import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toArabicDigits } from "@/lib/date-ar";

type Props = {
  done: number;
  inProgress: number;
  late: number;
  size?: number;
  showLegend?: boolean;
};

const COLORS = {
  done: "#059669",
  inProgress: "#D97706",
  late: "#DC2626",
} as const;

const LABELS: Record<keyof typeof COLORS, string> = {
  done: "منتهية",
  inProgress: "قيد التنفيذ",
  late: "متأخرة",
};

export function TaskPieChart({ done, inProgress, late, size = 120, showLegend = false }: Props) {
  const total = done + inProgress + late;
  const slices = (
    [
      { key: "done", value: done },
      { key: "inProgress", value: inProgress },
      { key: "late", value: late },
    ] as const
  ).filter((s) => s.value > 0);

  const inner = Math.max(8, Math.round(size * 0.32));
  const outer = Math.round(size / 2) - 2;

  return (
    <div className={showLegend ? "flex items-center gap-4 flex-wrap" : "inline-flex"}>
      <div style={{ width: size, height: size }} className="shrink-0">
        {total === 0 ? (
          <div
            className="rounded-full border-[6px] border-muted/40"
            style={{ width: size, height: size }}
            aria-label="لا توجد بيانات"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices.map((s) => ({ name: LABELS[s.key], value: s.value, key: s.key }))}
                dataKey="value"
                nameKey="name"
                innerRadius={inner}
                outerRadius={outer}
                stroke="none"
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={COLORS[s.key]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => toArabicDigits(v)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      {showLegend && (
        <ul className="space-y-1.5 text-sm">
          {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((k) => {
            const v = k === "done" ? done : k === "inProgress" ? inProgress : late;
            return (
              <li key={k} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: COLORS[k] }}
                />
                <span className="text-foreground">{LABELS[k]}</span>
                <span className="text-muted-foreground">{toArabicDigits(v)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
