import { Ruler, MoveHorizontal, Weight } from "lucide-react";

export type QuantityUnit = "m" | "yd" | "kg";

export const DEFAULT_QUANTITY_UNIT: QuantityUnit = "m";

export const QUANTITY_UNITS: {
  value: QuantityUnit;
  label: string;
  short: string;
  abbr: string;
  Icon: typeof Ruler;
}[] = [
  { value: "m", label: "Meters", short: "Mtr", abbr: "m", Icon: Ruler },
  { value: "yd", label: "Yards", short: "Yd", abbr: "yd", Icon: MoveHorizontal },
  { value: "kg", label: "Kilograms", short: "Kg", abbr: "kg", Icon: Weight },
];

export function normalizeUnit(unit?: string | null): QuantityUnit {
  if (!unit) return DEFAULT_QUANTITY_UNIT;
  const key = String(unit).toLowerCase().trim();
  if (key === "m" || key === "meter" || key === "meters" || key === "mts" || key === "mtr") return "m";
  if (key === "yd" || key === "yard" || key === "yards") return "yd";
  if (key === "kg" || key === "kilogram" || key === "kilograms" || key === "kgs") return "kg";
  return DEFAULT_QUANTITY_UNIT;
}

export function getUnitMeta(unit?: string | null) {
  const value = normalizeUnit(unit);
  return QUANTITY_UNITS.find((u) => u.value === value)!;
}

export function formatQuantity(qty: number | string | null | undefined, unit?: string | null) {
  const value = Number(qty) || 0;
  return `${value.toFixed(2)} ${getUnitMeta(unit).abbr}`;
}

export function sumQuantityByUnit(
  items: Array<{ meters?: number; unit?: string | null }>,
) {
  const totals: Record<QuantityUnit, number> = { m: 0, yd: 0, kg: 0 };
  for (const item of items || []) {
    totals[normalizeUnit(item.unit)] += Number(item.meters) || 0;
  }
  return totals;
}

export function formatUnitTotals(totals: Record<QuantityUnit, number>) {
  return (Object.entries(totals) as [QuantityUnit, number][])
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${qty.toFixed(2)} ${getUnitMeta(unit).abbr}`)
    .join(" + ") || `0 ${getUnitMeta(DEFAULT_QUANTITY_UNIT).abbr}`;
}
