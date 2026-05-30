export type TaskStatus = "new" | "inProgress" | "done" | "closed" | "late";
export type EmployeeStatus = "new" | "inProgress" | "done";

export const STATUS_META: Record<TaskStatus, { label: string; color: string; textOn: string }> = {
  new:        { label: "جديد",       color: "#2563EB", textOn: "#fff" },
  inProgress: { label: "قيد التنفيذ", color: "#D97706", textOn: "#fff" },
  done:       { label: "منتهي",      color: "#059669", textOn: "#fff" },
  closed:     { label: "Done",       color: "#6B7280", textOn: "#fff" },
  late:       { label: "متأخر",      color: "#DC2626", textOn: "#fff" },
};

export const EMP_STATUS_META: Record<EmployeeStatus, { label: string; color: string }> = {
  new:        { label: "جديد",       color: "#2563EB" },
  inProgress: { label: "قيد التنفيذ", color: "#D97706" },
  done:       { label: "منتهي",      color: "#059669" },
};
