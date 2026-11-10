import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterOption } from "@/hooks/useTableControls";

export type ToolbarFilter = {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  allLabel?: string;
};

type TableToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  onFilterChange: (key: string, value: string) => void;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  children?: React.ReactNode;
};

export function TableToolbar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onFilterChange,
  onClear,
  hasActiveFilters = false,
  children,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={filter.value || "all"}
            onValueChange={(value) => onFilterChange(filter.key, value)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={filter.allLabel || `All ${filter.label}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.allLabel || `All ${filter.label}`}</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {children}
        {hasActiveFilters && onClear && (
          <Button type="button" variant="outline" onClick={onClear} className="shrink-0">
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
