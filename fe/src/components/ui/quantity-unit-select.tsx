import { cn } from "@/lib/utils";
import {
  QUANTITY_UNITS,
  normalizeUnit,
  type QuantityUnit,
} from "@/lib/quantityUnits";

interface QuantityUnitSelectProps {
  value?: string | null;
  onChange: (unit: QuantityUnit) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const QuantityUnitSelect = ({
  value,
  onChange,
  disabled = false,
  className,
  size = "sm",
}: QuantityUnitSelectProps) => {
  const current = normalizeUnit(value);

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-input bg-background p-0.5",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
      role="group"
      aria-label="Quantity unit"
    >
      {QUANTITY_UNITS.map(({ value: unit, label, abbr, Icon }) => {
        const selected = current === unit;
        return (
          <button
            key={unit}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(unit)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded transition-colors",
              size === "sm" ? "h-7 min-w-7 px-1.5 text-[11px]" : "h-8 min-w-8 px-2 text-xs",
              selected
                ? "bg-brand-teal text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            <span className="font-medium uppercase">{abbr}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuantityUnitSelect;
