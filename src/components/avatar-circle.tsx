import { cn } from "@/lib/utils";

interface Props {
  name: string;
  color: string;
  size?: number;
  className?: string;
}

export function AvatarCircle({ name, color, size = 36, className }: Props) {
  const initial = name?.trim().charAt(0) || "؟";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(12, size * 0.4),
      }}
      aria-label={name}
    >
      {initial}
    </span>
  );
}
