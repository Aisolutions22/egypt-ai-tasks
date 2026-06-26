import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  color: string;
  size?: number;
  className?: string;
  avatarUrl?: string | null;
}

export function AvatarCircle({ name, color, size = 36, className, avatarUrl }: Props) {
  const initial = name?.trim().charAt(0) || "؟";
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [avatarUrl]);

  const showImage = !!avatarUrl && !failed;
  const ring = 2;

  if (showImage) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded-full shrink-0", className)}
        style={{ width: size, height: size, backgroundColor: color, padding: ring }}
        aria-label={name}
      >
        <img
          src={avatarUrl!}
          alt={name}
          onError={() => setFailed(true)}
          className="rounded-full object-cover w-full h-full block bg-background"
          style={{ width: size - ring * 2, height: size - ring * 2 }}
        />
      </span>
    );
  }

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
