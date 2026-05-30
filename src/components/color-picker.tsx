import { COLOR_PALETTE } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (color: string) => void;
  takenColors: string[];      // hex strings already used
  allowSelf?: string | null;  // current user's own color is selectable
}

export function ColorPicker({ value, onChange, takenColors, allowSelf }: Props) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
      {COLOR_PALETTE.map((c) => {
        const taken = takenColors.includes(c) && c !== allowSelf;
        const selected = value?.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            disabled={taken}
            onClick={() => onChange(c)}
            className={cn(
              "h-10 w-10 rounded-full transition-all border-2",
              taken && "opacity-25 cursor-not-allowed",
              selected ? "border-foreground ring-2 ring-offset-2 ring-foreground scale-110" : "border-transparent hover:scale-110",
            )}
            style={{ backgroundColor: c }}
            title={taken ? "محجوز" : c}
            aria-label={c}
          />
        );
      })}
    </div>
  );
}
