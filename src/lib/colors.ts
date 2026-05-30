export const COLOR_PALETTE = [
  "#FF6B2B", "#4B5EAA", "#10B981", "#8B5CF6",
  "#EF4444", "#F59E0B", "#06B6D4", "#EC4899",
  "#84CC16", "#F97316", "#6366F1", "#14B8A6",
] as const;

export type BrandColor = (typeof COLOR_PALETTE)[number];
