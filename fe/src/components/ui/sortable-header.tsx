import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortState } from "@/hooks/useTableControls";

type SortableHeaderProps = {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
};

export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = "left",
}: SortableHeaderProps) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={cn(className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors",
          align === "right" && "w-full justify-end",
          align === "center" && "w-full justify-center",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-50")} />
      </button>
    </TableHead>
  );
}
