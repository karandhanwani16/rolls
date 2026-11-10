import { useCallback, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
  key: string | null;
  direction: SortDirection;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type TableFilterConfig<T> = {
  key: string;
  label: string;
  options: FilterOption[];
  predicate: (item: T, value: string) => boolean;
  allLabel?: string;
};

type UseTableControlsOptions<T> = {
  data: T[] | undefined | null;
  searchFns?: Array<(item: T) => string | number | null | undefined>;
  getSortValue: (item: T, key: string) => string | number | Date | null | undefined;
  filters?: TableFilterConfig<T>[];
  defaultSort?: SortState;
};

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  direction: SortDirection
): number {
  const empty = a == null || a === "";
  const emptyB = b == null || b === "";
  if (empty && emptyB) return 0;
  if (empty) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (a instanceof Date || b instanceof Date) {
    const aTime = a instanceof Date ? a.getTime() : new Date(a as string | number).getTime();
    const bTime = b instanceof Date ? b.getTime() : new Date(b as string | number).getTime();
    result = aTime - bTime;
  } else if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

export function useTableControls<T>({
  data,
  searchFns = [],
  getSortValue,
  filters = [],
  defaultSort = { key: null, direction: "asc" },
}: UseTableControlsOptions<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key: null, direction: "asc" };
    });
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value === "all" ? "" : value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterValues({});
    setSort(defaultSort);
  }, [defaultSort]);

  const hasActiveFilters = useMemo(() => {
    if (searchTerm.trim()) return true;
    return Object.values(filterValues).some((v) => v && v !== "");
  }, [searchTerm, filterValues]);

  const rows = useMemo(() => {
    let result = [...(data || [])];
    const q = searchTerm.trim().toLowerCase();

    if (q && searchFns.length > 0) {
      result = result.filter((item) =>
        searchFns.some((fn) => {
          const value = fn(item);
          return value != null && String(value).toLowerCase().includes(q);
        })
      );
    }

    for (const filter of filters) {
      const value = filterValues[filter.key];
      if (value) {
        result = result.filter((item) => filter.predicate(item, value));
      }
    }

    if (sort.key) {
      const key = sort.key;
      const direction = sort.direction;
      result.sort((a, b) =>
        compareValues(getSortValue(a, key), getSortValue(b, key), direction)
      );
    }

    return result;
  }, [data, searchTerm, searchFns, filters, filterValues, sort, getSortValue]);

  const filterDefs = useMemo(
    () =>
      filters.map((f) => ({
        key: f.key,
        label: f.label,
        options: f.options,
        allLabel: f.allLabel || `All ${f.label}`,
        value: filterValues[f.key] || "all",
      })),
    [filters, filterValues]
  );

  return {
    searchTerm,
    setSearchTerm,
    sort,
    toggleSort,
    filterValues,
    setFilter,
    clearFilters,
    hasActiveFilters,
    filterDefs,
    rows,
  };
}

/** Build unique sorted options from a list of values. */
export function uniqueOptions(
  values: Array<string | null | undefined>,
  labelFn?: (value: string) => string
): FilterOption[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v != null && String(v).trim() !== "") {
      set.add(String(v).trim());
    }
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((value) => ({
      value,
      label: labelFn ? labelFn(value) : value,
    }));
}
